-- Migration: Make serviceId optional in PatientTreatment
-- Date: 2026-01-27
-- Reason: To allow ad-hoc treatments (or treatments created from Odontogram with temporary IDs) to be saved without a pre-existing Treatment record.

ALTER TABLE "PatientTreatment" ALTER COLUMN "serviceId" DROP NOT NULL;
