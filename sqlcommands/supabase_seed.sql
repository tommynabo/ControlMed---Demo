-- 1. Create Doctors
INSERT INTO "Doctor" ("id", "name", "specialization", "commissionPercentage") VALUES
('doc-1', 'Dr. House', 'Diagnostico', 0.30),
('doc-2', 'Dra. Grey', 'Cirugía', 0.30),
('doc-3', 'Dr. Strange', 'Neurología', 0.30),
('doc-4', 'Dra. Quinn', 'General', 0.30),
('doc-5', 'Dr. Oz', 'Nutrición', 0.30)
ON CONFLICT ("id") DO NOTHING;

-- 2. Create Users (Linked to Doctors)
INSERT INTO "User" ("id", "email", "password", "name", "role", "doctorId") VALUES
('user-1', 'dr1@clinic.com', '123', 'Dr. House', 'DOCTOR', 'doc-1'),
('user-2', 'dr2@clinic.com', '123', 'Dra. Grey', 'DOCTOR', 'doc-2'),
('user-3', 'dr3@clinic.com', '123', 'Dr. Strange', 'DOCTOR', 'doc-3'),
('user-4', 'dr4@clinic.com', '123', 'Dra. Quinn', 'DOCTOR', 'doc-4'),
('user-5', 'dr5@clinic.com', '123', 'Dr. Oz', 'DOCTOR', 'doc-5'),
('user-admin', 'admin@clinic.com', '123', 'Director Médico', 'ADMIN', NULL),
('user-rep1', 'recepcion1@clinic.com', '123', 'Recepción 1', 'RECEPTION', NULL),
('user-rep2', 'recepcion2@clinic.com', '123', 'Recepción 2', 'RECEPTION', NULL)
ON CONFLICT ("email") DO NOTHING;

-- 3. Create Dummy Patients
INSERT INTO "Patient" ("id", "name", "dni", "birthDate", "email", "insurance", "assignedDoctorId") VALUES
('pat-1', 'Juan Pérez', '12345678A', '1980-01-01', 'juan@test.com', 'Sanitas', 'doc-1'),
('pat-2', 'María López', '87654321B', '1992-05-15', 'maria@test.com', 'Adeslas', 'doc-2'),
('pat-3', 'Carlos Ruiz', '11223344C', '1975-11-30', 'carlos@test.com', 'DKV', 'doc-3')
ON CONFLICT ("dni") DO NOTHING;
