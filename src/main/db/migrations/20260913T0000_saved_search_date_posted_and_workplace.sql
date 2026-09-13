-- date_posted/workplace_types mirror the remaining fields buildSearchUrl
-- already accepts in scan.ts (SearchUrlParams) - saved searches couldn't use
-- them until now (geoId/distanceKm got the same treatment in
-- 20260912T0400_saved_search_geo_and_years.sql). workplace_types is a JSON
-- array (e.g. '["remote"]') since it's multi-select on LinkedIn's own filter.
ALTER TABLE linkedin_saved_searches ADD COLUMN date_posted TEXT;
ALTER TABLE linkedin_saved_searches ADD COLUMN workplace_types TEXT;
