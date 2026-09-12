-- One row per LinkedIn company - populated only when a real ('applied')
-- apply outcome fires the company-info fetch (see
-- ipc/handlers/linkedin.ts's onApplyResult hook, company.ts's
-- fetchCompanyAboutInfo). linkedin_company_id is nullable since the id
-- extraction from the /about page's html can fail to find any pattern.
CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  linkedin_company_id TEXT UNIQUE,
  name TEXT,
  url TEXT NOT NULL,
  website TEXT,
  industry TEXT,
  company_size TEXT,
  founded TEXT,
  specialties TEXT,
  overview TEXT,
  fetched_at TEXT NOT NULL
);
