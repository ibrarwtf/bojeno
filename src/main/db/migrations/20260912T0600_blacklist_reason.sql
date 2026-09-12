ALTER TABLE company_blacklist ADD COLUMN reason TEXT;

UPDATE company_blacklist SET reason = 'spam agency' WHERE reason IS NULL;

INSERT INTO company_blacklist (company_name, added_at, reason) VALUES
  ('Talentgigs', '2026-09-12T00:00:00.000Z', 'spam agency');
