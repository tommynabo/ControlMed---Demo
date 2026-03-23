const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.gnnacijqglcqonholpwt:tmns2007101020@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"
    }
  }
});

async function main() {
    try {
        console.log("⚡ Executing SQL to create Prescription table via Direct URL...");
        const sql = `
            CREATE TABLE IF NOT EXISTS "Prescription" (
                "id" TEXT NOT NULL,
                "patientId" TEXT NOT NULL,
                "doctorId" TEXT NOT NULL,
                "medication" TEXT NOT NULL,
                "pharmaceuticalForm" TEXT,
                "administrationRoute" TEXT,
                "packagesNumber" INTEGER,
                "dose" TEXT,
                "duration" TEXT,
                "posology" TEXT,
                "units" TEXT,
                "schedulePattern" TEXT,
                "prescriptionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "dispensationDate" TIMESTAMP(3),
                "dispensationOrderNumber" TEXT,
                "diagnosis" TEXT,
                "patientInstructions" TEXT,
                "pharmacyInstructions" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
            );

            -- Attempt to add constraints if tables exist
            DO $$
            BEGIN
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'Patient') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prescription_patientId_fkey') THEN
                    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
                END IF;
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'User') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prescription_doctorId_fkey') THEN
                    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
                END IF;
            END $$;

            -- Create INDEXES safely
            CREATE INDEX IF NOT EXISTS "Prescription_patientId_idx" ON "Prescription"("patientId");
            CREATE INDEX IF NOT EXISTS "Prescription_doctorId_idx" ON "Prescription"("doctorId");
        `;

        await prisma.$executeRawUnsafe(sql);
        console.log("✅ Prescription table created successfully or already exists.");
    } catch (error) {
        console.error("❌ Error creating table:", error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
