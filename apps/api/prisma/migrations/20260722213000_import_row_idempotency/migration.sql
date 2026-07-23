-- Make per-row validation failures idempotent across BullMQ retries.
CREATE UNIQUE INDEX "ImportError_importId_row_key" ON "ImportError"("importId", "row");
