-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Canton" AS ENUM ('GE');

-- CreateEnum
CREATE TYPE "TaxCaseStatus" AS ENUM ('created', 'documents_uploaded', 'extraction_in_progress', 'extraction_completed', 'user_review_in_progress', 'validation_blocked', 'ready_for_generation', 'generated', 'finalized', 'deleted');

-- CreateEnum
CREATE TYPE "DocumentClassification" AS ENUM ('PreviousTaxDeclaration', 'CurrentBlankDeclaration', 'SalaryCertificate', 'BankStatement', 'SecuritiesStatement', 'ThirdPillar', 'PensionFund', 'HealthInsurance', 'MedicalExpense', 'Childcare', 'Mortgage', 'RealEstate', 'Donation', 'Debt', 'Insurance', 'SelfEmployment', 'Vehicle', 'Other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'SCAN_REJECTED', 'TEXT_EXTRACTING', 'OCR_PROCESSING', 'CLASSIFIED', 'EXTRACTING', 'EXTRACTED', 'EXTRACTION_FAILED');

-- CreateEnum
CREATE TYPE "ClassificationSource" AS ENUM ('AI', 'USER');

-- CreateEnum
CREATE TYPE "TextExtractionMethod" AS ENUM ('NATIVE', 'OCR', 'MIXED', 'NONE');

-- CreateEnum
CREATE TYPE "ExtractionMethod" AS ENUM ('LLM', 'LLM_OCR', 'REGEX', 'MANUAL');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('extracted', 'needs_review', 'confirmed', 'edited_confirmed', 'rejected', 'not_applicable', 'missing', 'unresolved');

-- CreateEnum
CREATE TYPE "ConfirmationAction" AS ENUM ('CONFIRM', 'EDIT_CONFIRM', 'REJECT', 'NOT_APPLICABLE', 'MARK_MISSING', 'REQUEST_HELP');

-- CreateEnum
CREATE TYPE "PDFType" AS ENUM ('COMPLETED_DECLARATION', 'REVIEW_SUMMARY', 'SUPPORTING_DOCS_INDEX', 'ASSUMPTIONS_WARNINGS', 'MISSING_ITEMS_CHECKLIST', 'AUDIT_TRAIL', 'FINAL_PACKAGE_ZIP');

-- CreateEnum
CREATE TYPE "PDFFillMethod" AS ENUM ('ACROFORM', 'OVERLAY', 'MANUAL_REPORT', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_REGISTERED', 'USER_LOGIN', 'USER_LOGIN_FAILED', 'USER_LOGOUT', 'CASE_CREATED', 'CASE_DELETED', 'DOCUMENT_UPLOADED', 'DOCUMENT_DELETED', 'DOCUMENT_SCAN_BLOCKED', 'DOCUMENT_CLASSIFIED', 'DOCUMENT_EXTRACTED', 'FIELD_CONFIRMED', 'FIELD_EDITED_CONFIRMED', 'FIELD_REJECTED', 'FIELD_MARKED_NOT_APPLICABLE', 'FIELD_MARKED_MISSING', 'HELP_REQUESTED', 'VALIDATION_RUN', 'FINAL_DECLARATION_ACCEPTED', 'PDF_GENERATED', 'PACKAGE_DOWNLOADED', 'ADMIN_CASE_VIEWED');

-- CreateEnum
CREATE TYPE "MissingDocumentReason" AS ENUM ('NOT_UPLOADED', 'LOW_CONFIDENCE', 'PRESENT_LAST_YEAR_ABSENT_THIS_YEAR');

-- CreateEnum
CREATE TYPE "MissingDocumentStatus" AS ENUM ('OPEN', 'CONFIRMED_MISSING', 'MARKED_NOT_APPLICABLE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ValidationIssueType" AS ENUM ('MISSING_REQUIRED_FIELD', 'PREVIOUS_YEAR_INCONSISTENCY', 'UNUSUAL_CHANGE', 'DUPLICATE_DOCUMENT', 'DUPLICATE_DEDUCTION', 'CURRENCY_INCONSISTENCY', 'IMPOSSIBLE_VALUE', 'UNSUPPORTED_DOCUMENT_TYPE', 'LOW_CONFIDENCE_EXTRACTION', 'UNCONFIRMED_VALUE');

-- CreateEnum
CREATE TYPE "ValidationSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

-- CreateEnum
CREATE TYPE "ValidationIssueStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "TaxSectionKey" AS ENUM ('INCOME_EMPLOYMENT', 'INCOME_SELF_EMPLOYMENT', 'INCOME_SECURITIES', 'REAL_ESTATE', 'BANK_ACCOUNTS', 'THIRD_PILLAR', 'PENSION_FUND', 'DEDUCTIONS_PROFESSIONAL_EXPENSES', 'DEDUCTIONS_INSURANCE_PREMIUMS', 'DEDUCTIONS_MEDICAL_EXPENSES', 'DEDUCTIONS_CHILDCARE', 'DEDUCTIONS_DONATIONS', 'DEDUCTIONS_MORTGAGE_INTEREST', 'DEBTS', 'DEPENDENTS', 'VEHICLES', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_cases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canton" "Canton" NOT NULL DEFAULT 'GE',
    "taxYear" INTEGER NOT NULL,
    "status" "TaxCaseStatus" NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tax_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploaded_documents" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "classification" "DocumentClassification",
    "classificationConfidence" DOUBLE PRECISION,
    "classificationSource" "ClassificationSource",
    "textExtractionMethod" "TextExtractionMethod" NOT NULL DEFAULT 'NONE',
    "pageCount" INTEGER,
    "malwareScanClean" BOOLEAN,
    "malwareScanProvider" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uploaded_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_pages" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "rawText" TEXT,
    "ocrApplied" BOOLEAN NOT NULL DEFAULT false,
    "ocrConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extracted_fields" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "currency" TEXT,
    "period" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourcePageNumber" INTEGER,
    "evidenceExcerpt" TEXT,
    "extractionMethod" "ExtractionMethod" NOT NULL,
    "possibleTaxSectionKey" "TaxSectionKey",
    "needsUserConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'extracted',
    "editedValue" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extracted_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_sections" (
    "id" TEXT NOT NULL,
    "canton" "Canton" NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "key" "TaxSectionKey" NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tax_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_field_mappings" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "taxSectionId" TEXT NOT NULL,
    "extractedFieldId" TEXT,
    "declarationFieldCode" TEXT NOT NULL,
    "declarationFieldLabel" TEXT NOT NULL,
    "mappedValue" TEXT,
    "mappedCurrency" TEXT,
    "acroFormFieldName" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'needs_review',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_confirmations" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extractedFieldId" TEXT,
    "taxFieldMappingId" TEXT,
    "action" "ConfirmationAction" NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_pdfs" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "type" "PDFType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "fillMethod" "PDFFillMethod" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_pdfs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "taxCaseId" TEXT,
    "taxCaseIdSnapshot" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missing_documents" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "classification" "DocumentClassification" NOT NULL,
    "reason" "MissingDocumentReason" NOT NULL,
    "status" "MissingDocumentStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missing_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assumptions" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "extractedFieldId" TEXT,
    "taxFieldMappingId" TEXT,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_issues" (
    "id" TEXT NOT NULL,
    "taxCaseId" TEXT NOT NULL,
    "type" "ValidationIssueType" NOT NULL,
    "severity" "ValidationSeverity" NOT NULL,
    "status" "ValidationIssueStatus" NOT NULL DEFAULT 'OPEN',
    "relatedExtractedFieldId" TEXT,
    "relatedTaxFieldMappingId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "tax_cases_userId_idx" ON "tax_cases"("userId");

-- CreateIndex
CREATE INDEX "uploaded_documents_taxCaseId_idx" ON "uploaded_documents"("taxCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "document_pages_documentId_pageNumber_key" ON "document_pages"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "extracted_fields_taxCaseId_idx" ON "extracted_fields"("taxCaseId");

-- CreateIndex
CREATE INDEX "extracted_fields_documentId_idx" ON "extracted_fields"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_sections_canton_taxYear_key_key" ON "tax_sections"("canton", "taxYear", "key");

-- CreateIndex
CREATE INDEX "tax_field_mappings_taxCaseId_idx" ON "tax_field_mappings"("taxCaseId");

-- CreateIndex
CREATE INDEX "user_confirmations_taxCaseId_idx" ON "user_confirmations"("taxCaseId");

-- CreateIndex
CREATE INDEX "generated_pdfs_taxCaseId_idx" ON "generated_pdfs"("taxCaseId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_taxCaseId_idx" ON "audit_logs"("taxCaseId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "missing_documents_taxCaseId_idx" ON "missing_documents"("taxCaseId");

-- CreateIndex
CREATE INDEX "assumptions_taxCaseId_idx" ON "assumptions"("taxCaseId");

-- CreateIndex
CREATE INDEX "validation_issues_taxCaseId_idx" ON "validation_issues"("taxCaseId");

-- AddForeignKey
ALTER TABLE "tax_cases" ADD CONSTRAINT "tax_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_documents" ADD CONSTRAINT "uploaded_documents_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_pages" ADD CONSTRAINT "document_pages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "uploaded_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "uploaded_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_field_mappings" ADD CONSTRAINT "tax_field_mappings_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_field_mappings" ADD CONSTRAINT "tax_field_mappings_taxSectionId_fkey" FOREIGN KEY ("taxSectionId") REFERENCES "tax_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_field_mappings" ADD CONSTRAINT "tax_field_mappings_extractedFieldId_fkey" FOREIGN KEY ("extractedFieldId") REFERENCES "extracted_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_confirmations" ADD CONSTRAINT "user_confirmations_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_confirmations" ADD CONSTRAINT "user_confirmations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_confirmations" ADD CONSTRAINT "user_confirmations_extractedFieldId_fkey" FOREIGN KEY ("extractedFieldId") REFERENCES "extracted_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_confirmations" ADD CONSTRAINT "user_confirmations_taxFieldMappingId_fkey" FOREIGN KEY ("taxFieldMappingId") REFERENCES "tax_field_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_pdfs" ADD CONSTRAINT "generated_pdfs_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_pdfs" ADD CONSTRAINT "generated_pdfs_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missing_documents" ADD CONSTRAINT "missing_documents_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assumptions" ADD CONSTRAINT "assumptions_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assumptions" ADD CONSTRAINT "assumptions_extractedFieldId_fkey" FOREIGN KEY ("extractedFieldId") REFERENCES "extracted_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assumptions" ADD CONSTRAINT "assumptions_taxFieldMappingId_fkey" FOREIGN KEY ("taxFieldMappingId") REFERENCES "tax_field_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_taxCaseId_fkey" FOREIGN KEY ("taxCaseId") REFERENCES "tax_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_relatedExtractedFieldId_fkey" FOREIGN KEY ("relatedExtractedFieldId") REFERENCES "extracted_fields"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_relatedTaxFieldMappingId_fkey" FOREIGN KEY ("relatedTaxFieldMappingId") REFERENCES "tax_field_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
