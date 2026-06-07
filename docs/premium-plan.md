# Bingr Premium Membership Plan
# Created: 2026-06-06

## Pricing
- **Monthly:** $4.99/mo
- **Annual:** $59.88/yr ($4.99/mo equivalent)
- **Payment:** Stripe (2.9% + $0.30 per transaction)

## Stripe Fee Calculation
| Plan | Gross | Fee | Net | Net % |
|---|---|---|---|---|
| Monthly | $4.99 | $0.445 | $4.545 | 91.1% |
| Annual | $59.88 | $2.037 | $57.843 | 96.6% |

## Revenue Projections
| Members | Monthly Revenue | Annual Revenue |
|---|---|---|
| 100 | $455 | $5,784 |
| 1,000 | $4,545 | $57,843 |
| 10,000 | $45,453 | $578,435 |

## Tier Structure

### FREE
- Tracking (Want to Watch / Watching / Watched)
- Read reviews
- Up to 3 custom lists
- Ads shown

### PREMIUM ($4.99/mo)
- No ads
- Write reviews (requires Watched status)
- Year in Review statistics
- Unlimited custom lists
- Premium badge on profile
- Data export (CSV/JSON)
- AI-powered recommendations
- Early access to new features

## Stripe Integration
- **SDK:** `npm install stripe`
- **Env vars:** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- **UI:** Stripe Checkout (pre-built)
- **Webhook:** `/api/stripe/webhook` for subscription events
- **DB:** Supabase `subscriptions` table (user_id, stripe_customer_id, tier, expires_at)

## Competitor Reference
- Letterboxd Pro: $19/yr
- Letterboxd Patron: $49/yr
- Trakt VIP: $6/mo or $60/yr
- MyAnimeList: Free (ad-supported)
- AniList: Free

## Differentiator
Bingr combines tracking + reviews in one platform (unlike separate Letterboxd/Trakt + review-only platforms)
