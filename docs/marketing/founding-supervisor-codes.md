# Founding Supervisor — Stripe codes tracker

_Internal — gitignored. Tracks each Founding Supervisor's lifetime promo code, redemption state, and review URL. Mirrors what's in Stripe so we don't have to drill into the dashboard to remember._

## How the codes work

1. **One shared coupon in Stripe** (manually created, one-time): `founding_supervisor_lifetime` — 100% off forever, applies to all products. Create at Stripe Dashboard → Product catalog → Coupons → New.
2. **One promotion code per Founding Supervisor**, all tied to that coupon. `max_redemptions: 1` so they can't share.
3. **The URL pattern they receive**: `https://app.audithalo.com/dashboard/billing?promo=THEIR-CODE`. Hitting that URL drops them at Stripe Checkout with the code pre-applied and a $0 monthly total. Card collection is skipped because `payment_method_collection: "if_required"` is set in `startCheckoutAction`.

## Per-recipient table

| Name | Email | Code | Issued | Redeemed | Review URL | Notes |
|---|---|---|---|---|---|---|
| _example_ Maria Smith | maria@example.com | `MARIA-BETA` | 2026-06-10 | y | Capterra: link | First Founding member |

Add a row when you approve an application. Mark `Redeemed: y` once Stripe shows the code redeemed (or once the supervisor's account flips to `active` after the 12-month grace).

## Creating a new code (CLI shortcut)

```bash
# Replace MARIA-BETA with the recipient's code
stripe promotion_codes create \
  --coupon founding_supervisor_lifetime \
  --code MARIA-BETA \
  --max-redemptions 1
```

Or via the Stripe dashboard: Product catalog → Coupons → click `founding_supervisor_lifetime` → Add promotion code.

## Sanity check before sending the URL

- [ ] Recipient has applied via `/founding` and you've reviewed the application
- [ ] Their Stripe customer doesn't already have a redeemed code (one per email is the policy)
- [ ] Their account on app.audithalo.com exists and the Founding Supervisor badge is granted via `/admin/founding-supervisors`
- [ ] The promo code is active in Stripe (not yet redeemed, not expired)
