import type { DocumentClassification } from "@prisma/client";
import { getLLMProvider } from "@/lib/llm";
import { classifyByKeywords } from "@/lib/extraction/classifyHeuristics";
import type { ClassificationResult } from "@/lib/llm/types";

/**
 * PreviousTaxDeclaration and CurrentBlankDeclaration are set explicitly by
 * the user at upload time (dedicated upload slots in the workflow) — they
 * are deliberately excluded from automatic classification to avoid
 * ambiguity between "last year's filled declaration" and "this year's blank
 * declaration", which look nearly identical to a keyword/LLM classifier.
 */
export const AUTO_CLASSIFIABLE_TYPES: DocumentClassification[] = [
  "SalaryCertificate",
  "BankStatement",
  "SecuritiesStatement",
  "ThirdPillar",
  "PensionFund",
  "HealthInsurance",
  "MedicalExpense",
  "Childcare",
  "Mortgage",
  "RealEstate",
  "Donation",
  "Debt",
  "Insurance",
  "SelfEmployment",
  "Vehicle",
  "Other",
];

export async function classifyDocument(text: string, filename: string): Promise<ClassificationResult> {
  const provider = getLLMProvider();
  try {
    const result = await provider.classifyDocument(text, AUTO_CLASSIFIABLE_TYPES);
    if (!AUTO_CLASSIFIABLE_TYPES.includes(result.classification)) {
      return classifyByKeywords(text, filename);
    }
    return result;
  } catch {
    return classifyByKeywords(text, filename);
  }
}
