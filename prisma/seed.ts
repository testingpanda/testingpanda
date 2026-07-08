/**
 * Demo/seed script. Generates a fully populated example tax case using
 * synthetic mock documents (rendered as simple text PDFs) so the whole
 * workflow — upload, classification, extraction, review, validation,
 * generation — can be explored end to end without any real tax documents.
 * Controlled by SEED_DEMO_MODE (see .env.example). Safe to re-run.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { getEnv } from "../src/lib/env";
import { hashPassword } from "../src/lib/auth/password";
import { renderTextReportPdf } from "../src/lib/pdf/textReport";
import { validateUploadedFile } from "../src/lib/security/fileValidation";
import { getMalwareScanner } from "../src/lib/security/malwareScan";
import { encryptBuffer, encryptField, sha256Hex } from "../src/lib/crypto";
import { getStorageDriver, buildStorageKey } from "../src/lib/storage";
import { classifyAndExtractFields } from "../src/lib/extraction/pipeline";
import type { DocumentClassification } from "@prisma/client";

async function buildMockPdf(title: string, lines: string[]): Promise<Buffer> {
  return renderTextReportPdf({ title, sections: [{ heading: "", lines }] });
}

const MOCK_DOCUMENTS: Array<{ classification: DocumentClassification; filename: string; title: string; lines: string[] }> = [
  {
    classification: "PreviousTaxDeclaration",
    filename: "declaration_2024.pdf",
    title: "Déclaration fiscale 2024 (rempli) — Genève",
    lines: [
      "Salaire brut: CHF 88'000.00",
      "Cotisation 3e pilier A: CHF 6'883.00",
      "Compte bancaire UBS solde au 31.12: CHF 12'000.00",
      "Intérêts hypothécaires payés: CHF 4'000.00",
      "Frais de garde des enfants: CHF 3'000.00",
      "Dons à des œuvres d'utilité publique: CHF 200.00",
      "Personnes à charge: 1",
    ],
  },
  {
    classification: "CurrentBlankDeclaration",
    filename: "declaration_2025_vierge.pdf",
    title: "Déclaration fiscale 2025 — Genève (formulaire)",
    lines: [
      "Ce formulaire ne contient pas de champs remplissables (PDF plat).",
      "Section revenus:",
      "Section fortune:",
      "Section déductions:",
    ],
  },
  {
    classification: "SalaryCertificate",
    filename: "certificat_salaire_2025.pdf",
    title: "Certificat de salaire 2025",
    lines: [
      "Employeur: Acme Genève SA",
      "Salaire brut: CHF 95'000.00",
      "Salaire net: CHF 78'500.50",
      "Cotisations AVS/AI/APG: CHF 5'100.00",
      "Année fiscale 2025",
    ],
  },
  {
    classification: "BankStatement",
    filename: "releve_bancaire_2025.pdf",
    title: "Relevé de compte annuel 2025",
    lines: ["Banque: UBS Switzerland AG", "Solde au 31.12: CHF 15'320.40", "Intérêts: CHF 45.10"],
  },
  {
    classification: "ThirdPillar",
    filename: "attestation_pilier3a_2025.pdf",
    title: "Attestation de versement Pilier 3a 2025",
    lines: ["Fondation: Swiss Life Pilier 3a", "Cotisation: CHF 7'056.00", "Année fiscale 2025"],
  },
  {
    classification: "HealthInsurance",
    filename: "assurance_maladie_2025.pdf",
    title: "Attestation d'assurance-maladie 2025",
    lines: ["Assureur: Assura", "Prime annuelle: CHF 4'800.00", "Personnes assurées: 1"],
  },
  {
    classification: "Mortgage",
    filename: "hypotheque_2025.pdf",
    title: "Relevé hypothécaire annuel 2025",
    lines: ["Prêteur: Banque Cantonale de Genève", "Intérêts hypothécaires payés: CHF 4'200.00", "Solde restant dû: CHF 380'000.00"],
  },
  {
    classification: "Donation",
    filename: "attestation_don_2025.pdf",
    title: "Attestation de don 2025",
    lines: ["Organisation: Croix-Rouge genevoise", "Montant du don: CHF 500.00"],
  },
];

async function main() {
  const env = getEnv();
  if (!env.SEED_DEMO_MODE) {
    console.log("SEED_DEMO_MODE is false — skipping demo data seed.");
    return;
  }

  const passwordHash = await hashPassword(env.SEED_DEMO_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: env.SEED_DEMO_EMAIL },
    create: { email: env.SEED_DEMO_EMAIL, passwordHash, name: "Demo User", role: "USER" },
    update: {},
  });

  const existingDemoCase = await prisma.taxCase.findFirst({ where: { userId: user.id, taxYear: 2025 } });
  if (existingDemoCase) {
    console.log(`Demo case already exists for ${env.SEED_DEMO_EMAIL} (tax year 2025) — skipping.`);
    return;
  }

  const taxCase = await prisma.taxCase.create({ data: { userId: user.id, canton: "GE", taxYear: 2025, status: "created" } });

  const storage = getStorageDriver();
  const scanner = getMalwareScanner();

  for (const mock of MOCK_DOCUMENTS) {
    const buffer = await buildMockPdf(mock.title, mock.lines);
    const validation = validateUploadedFile({
      filename: mock.filename,
      declaredMimeType: "application/pdf",
      sizeBytes: buffer.length,
      buffer,
    });
    if (!validation.ok) {
      console.warn(`Skipping mock document ${mock.filename}: ${validation.reason}`);
      continue;
    }
    const scanResult = await scanner.scan(buffer);

    const document = await prisma.uploadedDocument.create({
      data: {
        taxCaseId: taxCase.id,
        uploadedByUserId: user.id,
        originalFilename: mock.filename,
        mimeType: "application/pdf",
        sizeBytes: buffer.length,
        storageKey: "",
        checksumSha256: sha256Hex(buffer),
        status: "UPLOADED",
        classification: mock.classification,
        classificationSource: "USER",
        malwareScanClean: scanResult.clean,
        malwareScanProvider: scanResult.provider,
      },
    });

    const key = buildStorageKey(taxCase.id, document.id, mock.filename);
    await storage.put(key, encryptBuffer(buffer, "file"));
    await prisma.uploadedDocument.update({ where: { id: document.id }, data: { storageKey: key } });

    // Seed mode intentionally does not re-parse the generated PDF's text through
    // the pdf-parse-based pipeline (see runExtractionPipeline): pdf-parse bundles
    // a very old pdfjs build that isn't reliably compatible with round-tripping
    // pdf-lib's own output. The known source text is used directly instead —
    // this exercises the exact same classification/extraction/mapping/validation
    // logic real uploads go through, just skipping PDF text re-parsing.
    const knownText = [mock.title, ...mock.lines].join("\n");
    await prisma.documentPage.create({
      data: { documentId: document.id, pageNumber: 1, rawText: encryptField(knownText, "field"), ocrApplied: false },
    });
    await prisma.uploadedDocument.update({
      where: { id: document.id },
      data: { pageCount: 1, textExtractionMethod: "NATIVE" },
    });
    await classifyAndExtractFields(document, knownText, taxCase.canton, taxCase.taxYear);
    console.log(`Seeded + extracted: ${mock.filename} (${mock.classification})`);
  }

  console.log(`\nDemo account ready:`);
  console.log(`  email:    ${env.SEED_DEMO_EMAIL}`);
  console.log(`  password: ${env.SEED_DEMO_PASSWORD}`);
  console.log(`  case:     ${taxCase.id} (tax year 2025)`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
