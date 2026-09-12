-- Widens `companies` for the GCC company-research import (a one-time
-- filesystem import, not a live LinkedIn scrape - see
-- scripts/import-gcc-companies.cjs) alongside the existing
-- apply-time /about scrape. `url` becomes nullable since an imported
-- company may have no resolved LinkedIn id/URL yet - a later real apply's
-- scrape fills it in without conflict, since upsertCompany never touches
-- these new columns.
ALTER TABLE companies RENAME TO companies_old;

CREATE TABLE companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  linkedin_company_id TEXT UNIQUE,
  name TEXT,
  url TEXT,
  website TEXT,
  industry TEXT,
  company_size TEXT,
  founded TEXT,
  specialties TEXT,
  overview TEXT,
  hq_country TEXT,
  india_cities TEXT, -- JSON-encoded string array, e.g. ["Hyderabad","Bengaluru"]
  careers_url TEXT,
  ats TEXT,
  status TEXT,
  skip_reason TEXT,
  remark TEXT,
  fetched_at TEXT NOT NULL
);

INSERT INTO companies (
  id, linkedin_company_id, name, url, website, industry, company_size,
  founded, specialties, overview, fetched_at
)
SELECT
  id, linkedin_company_id, name, url, website, industry, company_size,
  founded, specialties, overview, fetched_at
FROM companies_old;

DROP TABLE companies_old;
