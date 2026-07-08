import type { DocumentClassification, TaxSectionKey } from "@prisma/client";

/**
 * Geneva ("GE")-specific tax configuration: declaration sections and the
 * mapping from extracted document fields to declaration line items.
 *
 * IMPORTANT: the `declarationFieldCode` / `declarationFieldLabel` values
 * below are illustrative placeholders modeled on the general shape of the
 * Geneva cantonal tax return, NOT verified against a specific official
 * current-year form. Before relying on these in production, replace them
 * with the exact field codes from the real "déclaration fiscale" PDF for
 * the target tax year (see also acroFormFieldName resolution in
 * src/lib/extraction/mapping.ts, which prefers structurally-detected
 * AcroForm field names over these illustrative codes whenever available).
 *
 * Multi-canton extensibility: to add another canton, add a sibling config
 * object below and register it in CANTON_CONFIGS — no other code changes.
 */

export interface TaxSectionDefinition {
  key: TaxSectionKey;
  label: string;
  description: string;
  required: boolean;
  sortOrder: number;
}

export interface DeclarationFieldMapping {
  sectionKey: TaxSectionKey;
  declarationFieldCode: string;
  declarationFieldLabel: string;
}

export interface CantonConfig {
  canton: "GE";
  sections: TaxSectionDefinition[];
  fieldMappings: Partial<Record<DocumentClassification, Record<string, DeclarationFieldMapping>>>;
  /** Explicit pixel coordinates for overlay filling, keyed by declarationFieldCode. Empty until a
   * real form template has been analyzed — see src/lib/pdf/overlay.ts for why this must not be guessed. */
  overlayCoordinates: Record<string, { pageIndex: number; x: number; y: number }>;
}

export const GENEVA_CONFIG: CantonConfig = {
  canton: "GE",
  sections: [
    { key: "INCOME_EMPLOYMENT", label: "Employment income", description: "Salaries and employment income (certificat de salaire)", required: true, sortOrder: 10 },
    { key: "INCOME_SELF_EMPLOYMENT", label: "Self-employment income", description: "Net profit from independent activity", required: false, sortOrder: 20 },
    { key: "INCOME_SECURITIES", label: "Securities & investment income", description: "Dividends, interest and portfolio value", required: false, sortOrder: 30 },
    { key: "REAL_ESTATE", label: "Real estate", description: "Owned property, tax value, rental income", required: false, sortOrder: 40 },
    { key: "BANK_ACCOUNTS", label: "Bank accounts", description: "Balances at 31 December", required: true, sortOrder: 50 },
    { key: "THIRD_PILLAR", label: "3rd pillar (Pillar 3a)", description: "Pillar 3a contributions", required: false, sortOrder: 60 },
    { key: "PENSION_FUND", label: "2nd pillar / pension fund", description: "Voluntary LPP buy-ins", required: false, sortOrder: 70 },
    { key: "DEDUCTIONS_PROFESSIONAL_EXPENSES", label: "Professional expenses", description: "Commuting, meals, further training", required: false, sortOrder: 80 },
    { key: "DEDUCTIONS_INSURANCE_PREMIUMS", label: "Insurance premiums", description: "Health and life/liability insurance premiums", required: true, sortOrder: 90 },
    { key: "DEDUCTIONS_MEDICAL_EXPENSES", label: "Medical expenses", description: "Out-of-pocket medical costs above the deductible threshold", required: false, sortOrder: 100 },
    { key: "DEDUCTIONS_CHILDCARE", label: "Childcare costs", description: "Third-party childcare expenses", required: false, sortOrder: 110 },
    { key: "DEDUCTIONS_DONATIONS", label: "Donations", description: "Donations to eligible organizations", required: false, sortOrder: 120 },
    { key: "DEDUCTIONS_MORTGAGE_INTEREST", label: "Mortgage interest", description: "Deductible mortgage interest paid", required: false, sortOrder: 130 },
    { key: "DEBTS", label: "Debts", description: "Outstanding debts at 31 December", required: false, sortOrder: 140 },
    { key: "DEPENDENTS", label: "Dependents", description: "Dependent children / persons", required: false, sortOrder: 150 },
    { key: "VEHICLES", label: "Vehicles", description: "Vehicles counted towards taxable wealth", required: false, sortOrder: 160 },
    { key: "OTHER", label: "Other", description: "Anything not covered by another section", required: false, sortOrder: 999 },
  ],
  fieldMappings: {
    SalaryCertificate: {
      grossSalary: { sectionKey: "INCOME_EMPLOYMENT", declarationFieldCode: "11.10", declarationFieldLabel: "Revenu brut d'activité dépendante" },
    },
    BankStatement: {
      balanceAtYearEnd: { sectionKey: "BANK_ACCOUNTS", declarationFieldCode: "23.10", declarationFieldLabel: "Solde des comptes bancaires au 31.12" },
      interestEarned: { sectionKey: "INCOME_SECURITIES", declarationFieldCode: "21.10", declarationFieldLabel: "Intérêts bancaires" },
    },
    SecuritiesStatement: {
      totalPortfolioValue: { sectionKey: "INCOME_SECURITIES", declarationFieldCode: "23.20", declarationFieldLabel: "Valeur des titres au 31.12" },
      totalDividendIncome: { sectionKey: "INCOME_SECURITIES", declarationFieldCode: "21.20", declarationFieldLabel: "Rendement des titres" },
    },
    ThirdPillar: {
      contributionAmount: { sectionKey: "THIRD_PILLAR", declarationFieldCode: "46.10", declarationFieldLabel: "Cotisations 3e pilier A" },
    },
    PensionFund: {
      voluntaryBuyInAmount: { sectionKey: "PENSION_FUND", declarationFieldCode: "45.10", declarationFieldLabel: "Rachat d'années de cotisation LPP" },
    },
    HealthInsurance: {
      annualPremium: { sectionKey: "DEDUCTIONS_INSURANCE_PREMIUMS", declarationFieldCode: "47.10", declarationFieldLabel: "Primes d'assurance-maladie" },
    },
    Insurance: {
      annualPremium: { sectionKey: "DEDUCTIONS_INSURANCE_PREMIUMS", declarationFieldCode: "47.20", declarationFieldLabel: "Primes d'assurance vie / RC" },
    },
    MedicalExpense: {
      amountPaid: { sectionKey: "DEDUCTIONS_MEDICAL_EXPENSES", declarationFieldCode: "49.10", declarationFieldLabel: "Frais médicaux non remboursés" },
    },
    Childcare: {
      amountPaid: { sectionKey: "DEDUCTIONS_CHILDCARE", declarationFieldCode: "48.10", declarationFieldLabel: "Frais de garde des enfants" },
    },
    Mortgage: {
      interestPaid: { sectionKey: "DEDUCTIONS_MORTGAGE_INTEREST", declarationFieldCode: "36.10", declarationFieldLabel: "Intérêts hypothécaires" },
      outstandingBalance: { sectionKey: "DEBTS", declarationFieldCode: "34.10", declarationFieldLabel: "Dettes hypothécaires" },
    },
    RealEstate: {
      taxValue: { sectionKey: "REAL_ESTATE", declarationFieldCode: "23.30", declarationFieldLabel: "Valeur fiscale de l'immeuble" },
      rentalIncome: { sectionKey: "REAL_ESTATE", declarationFieldCode: "21.30", declarationFieldLabel: "Revenu locatif" },
      maintenanceCosts: { sectionKey: "REAL_ESTATE", declarationFieldCode: "21.40", declarationFieldLabel: "Frais d'entretien déductibles" },
    },
    Donation: {
      amountDonated: { sectionKey: "DEDUCTIONS_DONATIONS", declarationFieldCode: "50.10", declarationFieldLabel: "Dons à des œuvres d'utilité publique" },
    },
    Debt: {
      outstandingBalance: { sectionKey: "DEBTS", declarationFieldCode: "34.20", declarationFieldLabel: "Autres dettes" },
      interestPaid: { sectionKey: "DEBTS", declarationFieldCode: "36.20", declarationFieldLabel: "Intérêts passifs" },
    },
    SelfEmployment: {
      netProfit: { sectionKey: "INCOME_SELF_EMPLOYMENT", declarationFieldCode: "13.10", declarationFieldLabel: "Bénéfice net de l'activité indépendante" },
    },
    Vehicle: {
      purchaseValue: { sectionKey: "VEHICLES", declarationFieldCode: "23.40", declarationFieldLabel: "Valeur du véhicule" },
    },
  },
  overlayCoordinates: {},
};

const CANTON_CONFIGS: Record<string, CantonConfig> = {
  GE: GENEVA_CONFIG,
};

export function getCantonConfig(canton: string): CantonConfig {
  const config = CANTON_CONFIGS[canton];
  if (!config) throw new Error(`No tax configuration registered for canton "${canton}"`);
  return config;
}

export function getDeclarationMapping(
  canton: string,
  documentType: DocumentClassification,
  fieldKey: string
): DeclarationFieldMapping | null {
  const config = getCantonConfig(canton);
  return config.fieldMappings[documentType]?.[fieldKey] ?? null;
}
