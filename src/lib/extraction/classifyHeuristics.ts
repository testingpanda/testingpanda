import type { DocumentClassification } from "@prisma/client";

/**
 * Deterministic keyword classifier. Used directly by the mock LLM provider,
 * and also as a same-process fallback if a real LLM provider errors or times
 * out — classification must never hard-fail the pipeline, it should degrade
 * to "Other" with low confidence and let the user correct it.
 */
const KEYWORD_MAP: Array<{ type: DocumentClassification; keywords: string[] }> = [
  { type: "SalaryCertificate", keywords: ["certificat de salaire", "salary certificate", "lohnausweis"] },
  { type: "ThirdPillar", keywords: ["pilier 3a", "3e pilier", "pillar 3a", "third pillar"] },
  { type: "PensionFund", keywords: ["caisse de pension", "lpp", "pension fund", "2e pilier"] },
  { type: "HealthInsurance", keywords: ["assurance maladie", "lamal", "health insurance", "krankenkasse"] },
  { type: "MedicalExpense", keywords: ["frais médicaux", "medical expense", "facture médicale", "dentiste"] },
  { type: "Childcare", keywords: ["crèche", "garde d'enfants", "childcare", "daycare"] },
  { type: "Mortgage", keywords: ["hypothèque", "mortgage", "hypothek"] },
  { type: "RealEstate", keywords: ["bien immobilier", "valeur fiscale", "real estate", "propriété"] },
  { type: "Donation", keywords: ["don ", "donation", "attestation de don"] },
  { type: "SecuritiesStatement", keywords: ["titres", "valeurs mobilières", "portefeuille", "securities", "relevé fiscal"] },
  { type: "BankStatement", keywords: ["relevé de compte", "bank statement", "extrait de compte"] },
  { type: "Debt", keywords: ["reconnaissance de dette", "debt statement"] },
  { type: "Insurance", keywords: ["assurance vie", "assurance responsabilité civile", "insurance policy"] },
  { type: "SelfEmployment", keywords: ["indépendant", "self-employed", "raison individuelle"] },
  { type: "Vehicle", keywords: ["carte grise", "vehicle registration"] },
];

export function classifyByKeywords(
  text: string,
  filename: string
): { classification: DocumentClassification; confidence: number; rationale: string } {
  const haystack = `${filename}\n${text}`.toLowerCase();
  for (const { type, keywords } of KEYWORD_MAP) {
    const hit = keywords.find((k) => haystack.includes(k));
    if (hit) {
      return { classification: type, confidence: 0.68, rationale: `Matched keyword "${hit}"` };
    }
  }
  return { classification: "Other", confidence: 0.3, rationale: "No keyword match found; defaulted to Other" };
}
