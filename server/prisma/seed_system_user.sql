-- Ensure System Admin exists for relations
INSERT INTO "User" (id, email, password, name, role)
VALUES ('00000000-0000-0000-0000-000000000000', 'admin@clinicadental.com', '$2b$10$6R6V7fP.l0U6N1vK/3HlUuP7LzZ/nQ2W9X4K1L0M1N2P3Q4R5S6T7', 'Admin Sistema', 'ADMIN')
ON CONFLICT (id) DO NOTHING;
