-- VERIFICAR antes de eliminar:
SELECT id, "invoiceNumber", amount, date, concept, status
FROM "Invoice"
WHERE "invoiceNumber" = 'F-2026-1776766509143';

-- ELIMINAR la factura duplicada (las 18:00):
DELETE FROM "Invoice"
WHERE "invoiceNumber" = 'F-2026-1776766509143';