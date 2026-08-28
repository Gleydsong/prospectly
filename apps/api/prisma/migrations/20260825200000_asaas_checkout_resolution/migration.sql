-- A resolved attempt can be safely reused for a later checkout without retrying an uncertain request.
ALTER TYPE "BillingCheckoutAttemptStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
