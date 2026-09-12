-- geoId/distanceKm mirror the same fields buildSearchUrl already accepts in
-- scan.ts (SearchUrlParams) - saved searches couldn't use them until now.
ALTER TABLE linkedin_saved_searches ADD COLUMN geo_id TEXT;
ALTER TABLE linkedin_saved_searches ADD COLUMN distance_km INTEGER;
