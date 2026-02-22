# Charity Payments Module

**Last Updated:** 2026-02-22  
**Route:** `/charity`  
**Status:** Feature-flagged (easy on/off)

## Purpose

Provide optional contribution rails for a charity pot without coupling core game flows to payment logic.

## Fast Disable (Workplace Off-Switch)

Set:

```bash
NEXT_PUBLIC_ENABLE_CHARITY_POT=false
```

Effect:

- `Charity` nav item disappears.
- `/charity` route returns 404.
- No core gameplay logic is affected.

## Environment Variables

```bash
NEXT_PUBLIC_ENABLE_CHARITY_POT=true
NEXT_PUBLIC_CHARITY_CAMPAIGN_NAME="GIS Charity Pot"
NEXT_PUBLIC_CHARITY_BENEFICIARY="Approved School Charity Partner"
NEXT_PUBLIC_CHARITY_STRIPE_URL="https://buy.stripe.com/..."
NEXT_PUBLIC_CHARITY_PAYPAL_URL="https://www.paypal.com/donate/..."
NEXT_PUBLIC_CHARITY_TERMS_URL="https://..."
NEXT_PUBLIC_CHARITY_DISCLAIMER="Contributions are optional and processed by third-party payment providers."
```

## Current Implementation

- Frontend-only payment rails via hosted provider links.
- No direct card data enters app backend.
- Implemented in:
  - `/app/charity/page.tsx`
  - `/app/charity/page.client.tsx`
  - `/lib/charity.ts`
  - `/lib/features.ts`

## Compliance Notes

- Do not label contributions as tax-deductible unless legally validated for your jurisdiction and beneficiary entity.
- Keep charity terms and beneficiary disclosure visible on the page and in any campaign communication.

## Next Phase (Optional)

- Add webhook-backed contribution ledger (`contributions` collection) for public transparency totals.
- Add payout/audit reports for finance/admin review.

