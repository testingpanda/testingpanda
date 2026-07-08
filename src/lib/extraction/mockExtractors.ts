import type { DocumentClassification } from "@prisma/client";
import type { FieldSpec } from "@/lib/llm/types";
import { FIELD_SPECS } from "@/lib/extraction/fieldSpecs";

/**
 * Deterministic, offline "extraction engine" used when LLM_PROVIDER=mock
 * (the default). It never calls out to the network, which makes local dev,
 * CI, and demos fully reproducible. Confidence scores are intentionally
 * capped below what a real LLM would report, so mock-extracted values still
 * route through mandatory user review like any other low-confidence value.
 */

const AMOUNT_REGEX = /(\d{1,3}(?:[',’]\d{3})*(?:\.\d{1,2})?)/g;
const DATE_REGEX = /(\d{1,2}[./]\d{1,2}[./]\d{2,4})/;
const YEAR_REGEX = /(20\d{2})/;

const KEYWORD_OVERRIDES: Record<string, string[]> = {
  grossSalary: ["salaire brut", "gross salary", "revenu brut"],
  netSalary: ["salaire net", "net salary"],
  socialContributions: ["avs/ai/apg", "cotisations", "social contributions"],
  balanceAtYearEnd: ["solde au 31", "closing balance", "solde final"],
  interestEarned: ["intérêts", "interest earned"],
  totalPortfolioValue: ["valeur totale", "total value", "valeur du portefeuille"],
  totalDividendIncome: ["dividende", "dividend income"],
  withholdingTaxCredit: ["impôt anticipé", "withholding tax"],
  contributionAmount: ["cotisation", "contribution", "versement"],
  voluntaryBuyInAmount: ["rachat", "buy-in"],
  annualPremium: ["prime annuelle", "annual premium"],
  amountPaid: ["montant payé", "amount paid", "total ttc", "total"],
  outstandingBalance: ["solde restant", "outstanding balance", "capital restant dû"],
  interestPaid: ["intérêts payés", "interest paid", "intérêts hypothécaires"],
  taxValue: ["valeur fiscale", "official tax value"],
  rentalIncome: ["loyer", "rental income", "revenu locatif"],
  maintenanceCosts: ["frais d'entretien", "maintenance costs"],
  amountDonated: ["montant du don", "amount donated"],
  netProfit: ["bénéfice net", "net profit"],
  businessExpenses: ["charges d'exploitation", "business expenses"],
  purchaseValue: ["valeur d'achat", "purchase value"],
  priorGrossSalary: ["salaire brut"],
  priorThirdPillarContribution: ["pilier 3a", "3e pilier"],
  priorBankAccountsTotal: ["compte bancaire", "bank account"],
  priorMortgageInterest: ["intérêts hypothécaires"],
  priorChildcareCosts: ["garde d'enfants", "frais de garde"],
  priorDonations: ["dons"],
  priorNumberOfDependents: ["personnes à charge", "dependents"],
};

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/['’]/g, ""));
}

function findLineWithKeyword(lines: string[], keywords: string[]): string | null {
  const lower = keywords.map((k) => k.toLowerCase());
  return lines.find((line) => lower.some((k) => line.toLowerCase().includes(k))) ?? null;
}

export function mockExtractDocument(documentType: DocumentClassification, text: string): Record<string, unknown> {
  const specs: FieldSpec[] = FIELD_SPECS[documentType] ?? [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const result: Record<string, unknown> = {};

  for (const spec of specs) {
    const keywords = KEYWORD_OVERRIDES[spec.key] ?? spec.label.toLowerCase().split(" ");
    const line = findLineWithKeyword(lines, keywords);

    if (spec.type === "amount") {
      const searchText = line ?? text;
      const matches = searchText.match(AMOUNT_REGEX);
      const amount = matches ? parseAmount(matches[matches.length - 1]) : null;
      result[spec.key] = {
        value: amount,
        confidence: amount !== null ? (line ? 0.72 : 0.4) : 0,
        evidenceExcerpt: amount !== null ? (line ?? searchText.slice(0, 160)) : null,
        currency: amount !== null ? "CHF" : null,
        period: null,
      };
    } else if (spec.type === "date") {
      const searchText = line ?? text;
      const match = searchText.match(DATE_REGEX);
      result[spec.key] = {
        value: match ? match[1] : null,
        confidence: match ? 0.65 : 0,
        evidenceExcerpt: match ? (line ?? match[0]) : null,
        currency: null,
        period: null,
      };
    } else if (spec.type === "period") {
      const match = text.match(YEAR_REGEX);
      result[spec.key] = {
        value: match ? match[1] : null,
        confidence: match ? 0.6 : 0,
        evidenceExcerpt: match ? match[0] : null,
        currency: null,
        period: match ? match[1] : null,
      };
    } else if (spec.type === "boolean") {
      result[spec.key] = { value: null, confidence: 0, evidenceExcerpt: null, currency: null, period: null };
    } else {
      if (line) {
        const parts = line.split(/[:\-]/);
        const value = parts.length > 1 ? parts.slice(1).join(":").trim() : line;
        result[spec.key] = {
          value: value || line,
          confidence: 0.6,
          evidenceExcerpt: line,
          currency: null,
          period: null,
        };
      } else {
        result[spec.key] = {
          value: lines[0] ?? null,
          confidence: lines[0] ? 0.3 : 0,
          evidenceExcerpt: lines[0] ?? null,
          currency: null,
          period: null,
        };
      }
    }
  }

  return result;
}
