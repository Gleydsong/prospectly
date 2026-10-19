-- Tenant equality followed by latitude range narrows viewport scans. Longitude
-- remains in the index for the remaining bounding-box predicate.
-- Run outside a transaction so saved-client writes remain available during indexing.
CREATE INDEX CONCURRENTLY "Lead_organizationId_latitude_longitude_idx"
ON "Lead"("organizationId", "latitude", "longitude");
