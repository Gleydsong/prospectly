# Billing payments

## Current routing

Prospectly accepts BRL payments through PIX using AbacatePay. Credit-card checkout is intentionally unavailable until a replacement provider is selected and implemented.

| Product | Price | Method | Provider |
| --- | ---: | --- | --- |
| 2,000 credits | R$ 14.99 | PIX | AbacatePay |
| 5,000 credits | R$ 23.99 | PIX | AbacatePay |
| Monthly unlimited | R$ 49.99 | PIX | AbacatePay |

The API keeps historical Stripe identifiers and the `STRIPE` provider enum value for existing records only. There is no Stripe checkout runtime and new card payments must not be routed to Stripe or AbacatePay.

## Safety properties

- Benefits are granted only after an authenticated AbacatePay webhook is verified.
- Monthly PIX checkout creation uses a durable attempt record to prevent concurrent duplicate checkout creation.
- Legacy clients that submit `paymentMethod=card` receive a controlled rejection.
- A future card gateway must be added behind the payment-provider boundary without changing PIX ownership.

See [Render deployment](../deploy/render.md) for environment and webhook setup.
