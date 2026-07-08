import type { DocumentClassification } from "@prisma/client";
import type { FieldSpec } from "@/lib/llm/types";

/**
 * Per-document-type field specifications. This is the single source of
 * truth for: (1) what we ask the LLM/mock engine to extract, (2) the strict
 * per-document-type Zod schema shape (see src/lib/extraction/schemas.ts),
 * and (3) which tax section a field is expected to map into
 * (see src/lib/taxSections/geneva.ts). CurrentBlankDeclaration has no
 * fields — it is the target form, handled structurally by the PDF pipeline
 * instead of the extraction pipeline.
 */
export const FIELD_SPECS: Record<DocumentClassification, FieldSpec[]> = {
  PreviousTaxDeclaration: [
    { key: "priorGrossSalary", label: "Prior year gross salary", type: "amount", description: "Total gross employment income declared last year" },
    { key: "priorThirdPillarContribution", label: "Prior year 3rd pillar contribution", type: "amount", description: "Pillar 3a contribution declared last year" },
    { key: "priorBankAccountsTotal", label: "Prior year bank accounts total", type: "amount", description: "Sum of declared bank account balances" },
    { key: "priorMortgageInterest", label: "Prior year mortgage interest", type: "amount", description: "Deducted mortgage interest last year" },
    { key: "priorChildcareCosts", label: "Prior year childcare costs", type: "amount", description: "Declared childcare deduction last year" },
    { key: "priorDonations", label: "Prior year donations", type: "amount", description: "Declared donations deduction last year" },
    { key: "priorNumberOfDependents", label: "Prior year number of dependents", type: "string", description: "Number of dependent children declared" },
  ],
  CurrentBlankDeclaration: [],
  SalaryCertificate: [
    { key: "employerName", label: "Employer name", type: "string", description: "Name of the employer issuing the certificate" },
    { key: "grossSalary", label: "Gross salary", type: "amount", description: "Total gross salary (net salary before deductions), field 1-3 of the Swiss salary certificate" },
    { key: "netSalary", label: "Net salary", type: "amount", description: "Net salary paid out" },
    { key: "socialContributions", label: "Social contributions (AVS/AI/APG/AC)", type: "amount", description: "Total mandatory social insurance contributions withheld" },
    { key: "taxYear", label: "Tax year", type: "period", description: "Calendar year the certificate covers" },
  ],
  BankStatement: [
    { key: "bankName", label: "Bank name", type: "string", description: "Name of the financial institution" },
    { key: "accountNumberOrIban", label: "Account number / IBAN", type: "string", description: "Account identifier" },
    { key: "balanceAtYearEnd", label: "Balance at 31 December", type: "amount", description: "Closing balance at end of tax year, used for wealth tax" },
    { key: "interestEarned", label: "Interest earned", type: "amount", description: "Taxable interest income for the year" },
  ],
  SecuritiesStatement: [
    { key: "institutionName", label: "Institution name", type: "string", description: "Bank/broker holding the securities" },
    { key: "totalPortfolioValue", label: "Total portfolio value at year end", type: "amount", description: "Total value of securities held at 31 December" },
    { key: "totalDividendIncome", label: "Total dividend/interest income", type: "amount", description: "Taxable investment income for the year" },
    { key: "withholdingTaxCredit", label: "Swiss withholding tax credit", type: "amount", description: "Verrechnungssteuer / impôt anticipé reclaimable" },
  ],
  ThirdPillar: [
    { key: "institutionName", label: "Institution / foundation name", type: "string", description: "Pillar 3a provider" },
    { key: "contributionAmount", label: "Contribution amount", type: "amount", description: "Total pillar 3a contribution paid during the tax year" },
    { key: "taxYear", label: "Tax year", type: "period", description: "Year the contribution applies to" },
  ],
  PensionFund: [
    { key: "institutionName", label: "Pension fund name", type: "string", description: "2nd pillar / LPP institution" },
    { key: "voluntaryBuyInAmount", label: "Voluntary buy-in amount", type: "amount", description: "Additional voluntary purchase of pension fund years" },
  ],
  HealthInsurance: [
    { key: "insurerName", label: "Insurer name", type: "string", description: "Health insurance company" },
    { key: "annualPremium", label: "Annual premium paid", type: "amount", description: "Total base + supplementary premiums paid for the year" },
    { key: "numberOfInsuredPersons", label: "Number of insured persons", type: "string", description: "Number of family members covered" },
  ],
  MedicalExpense: [
    { key: "provider", label: "Provider", type: "string", description: "Doctor, dentist, hospital or pharmacy" },
    { key: "amountPaid", label: "Amount paid (not reimbursed)", type: "amount", description: "Out-of-pocket medical expense not covered by insurance" },
    { key: "expenseDate", label: "Date of expense", type: "date", description: "Date the expense was incurred" },
  ],
  Childcare: [
    { key: "provider", label: "Childcare provider", type: "string", description: "Crèche / daycare / registered childminder" },
    { key: "amountPaid", label: "Amount paid", type: "amount", description: "Total childcare fees paid during the tax year" },
    { key: "childName", label: "Child name", type: "string", description: "Name of the child the invoice concerns" },
  ],
  Mortgage: [
    { key: "lenderName", label: "Lender name", type: "string", description: "Bank issuing the mortgage" },
    { key: "outstandingBalance", label: "Outstanding balance at year end", type: "amount", description: "Remaining mortgage debt at 31 December, used for wealth tax" },
    { key: "interestPaid", label: "Interest paid", type: "amount", description: "Mortgage interest paid during the tax year, deductible" },
    { key: "propertyAddress", label: "Property address", type: "string", description: "Address of the mortgaged property" },
  ],
  RealEstate: [
    { key: "propertyAddress", label: "Property address", type: "string", description: "Address of the property" },
    { key: "taxValue", label: "Official tax value (valeur fiscale)", type: "amount", description: "Cantonal tax value of the property" },
    { key: "rentalIncome", label: "Rental income", type: "amount", description: "Annual rental income if the property is rented out" },
    { key: "maintenanceCosts", label: "Maintenance costs", type: "amount", description: "Deductible maintenance/upkeep costs" },
  ],
  Donation: [
    { key: "organizationName", label: "Organization name", type: "string", description: "Recipient charity/organization" },
    { key: "amountDonated", label: "Amount donated", type: "amount", description: "Total donated during the tax year" },
  ],
  Debt: [
    { key: "creditorName", label: "Creditor name", type: "string", description: "Institution or person owed" },
    { key: "outstandingBalance", label: "Outstanding balance at year end", type: "amount", description: "Debt balance at 31 December" },
    { key: "interestPaid", label: "Interest paid", type: "amount", description: "Deductible interest paid on the debt" },
  ],
  Insurance: [
    { key: "insurerName", label: "Insurer name", type: "string", description: "Life/liability/other insurance company" },
    { key: "annualPremium", label: "Annual premium paid", type: "amount", description: "Deductible insurance premium paid for the year" },
    { key: "policyType", label: "Policy type", type: "string", description: "e.g. life insurance, liability insurance" },
  ],
  SelfEmployment: [
    { key: "businessName", label: "Business name", type: "string", description: "Name of the sole proprietorship / self-employment activity" },
    { key: "netProfit", label: "Net profit", type: "amount", description: "Net self-employment income for the year" },
    { key: "businessExpenses", label: "Business expenses", type: "amount", description: "Total deductible business expenses" },
  ],
  Vehicle: [
    { key: "vehicleDescription", label: "Vehicle description", type: "string", description: "Make/model of the vehicle" },
    { key: "purchaseValue", label: "Purchase / current value", type: "amount", description: "Value used for wealth tax if applicable" },
  ],
  Other: [
    { key: "documentSummary", label: "Document summary", type: "string", description: "One-sentence summary of what this document is" },
  ],
};
