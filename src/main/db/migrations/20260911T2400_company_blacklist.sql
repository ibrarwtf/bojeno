CREATE TABLE company_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL UNIQUE,
  added_at TEXT NOT NULL
);

INSERT INTO company_blacklist (company_name, added_at) VALUES
  ('Hire Feed', '2026-09-11T00:00:00.000Z'),
  ('Quik Hire Staffing', '2026-09-11T00:00:00.000Z');
