# QRWait

**Virtual queue with a QR code, no app.** Take your number, let your phone do the waiting.

QRWait is a location-aware queue system for places where people wait: beaches and pools, piers and bus lines, municipal service points, event entrances, restaurants and clinics. Visitors scan the QR code on the attendant's screen, join from the page that opens and follow their place live; their phone buzzes when it's their turn.

🌐 **[qrwait.app](https://qrwait.app)** · Turkish, English, German, Russian

## How it works

1. **Scan the QR code** on the attendant's tablet or phone and choose your group size.
2. **Follow your place** live. Nobody takes it while you sit in the shade.
3. **Come when it's your turn.** The phone vibrates, the screen turns green, you show your number.

### Fair for everyone

- **No joining from home:** the phone's location must be near the queue.
- **Screenshots don't work:** the QR code rotates every few seconds.
- **One phone, one place,** with an upper limit on group size.
- **Nobody without a phone is left out:** the attendant adds them with one tap.

### For operators

- Two queue modes: **seats** (a pool of free places, e.g. sunbeds or bus seats) and **tables** (restaurants).
- Enter how many places opened up and the next groups are called automatically; flexible groups can accept fewer places (4 people may settle for 2 sunbeds), and optionally smaller groups that fit are moved ahead.
- Drop a no-show with one tap; their place goes to the next group.
- Optional time to arrive (3–30 min): a called group that doesn't show up is dropped automatically, with a countdown on the visitor's screen.
- Visitors see an estimated wait based on the recent call rate and get a "your turn is coming up" push two groups ahead.
- Joins can be paused from the attendant panel, limited to set hours, or capped at a maximum number of waiting groups.
- Per-queue daily statistics (joined, served, no-shows, average wait, joins by hour) with CSV export; counts only, no personal data.
- Location check per queue: fixed point, the attendant's live location, or off.
- Each queue is placed on a map and gets its own address (`<user>.qrwait.app/<queue>`) with a public status page. Hidden queues get an unguessable address instead.
- Attendant panel runs in the browser, no installation. Web Push notifications for visitors.
- Self-service sign-up with 1000 free tickets; more are bought as one-time USD packages via Lemon Squeezy (public price list at `/pricing`).

## Stack

| Part | Technology |
| --- | --- |
| Backend | Cloudflare Workers, Durable Objects (`Room` per queue, `Registry` for users and addresses, `Account` per user for ticket balance) |
| Frontend | React 19, Vite, Tailwind CSS 4, shadcn/ui, Leaflet |
| Email | Cloudflare Email Service |
| Abuse protection | Cloudflare Turnstile, Workers rate limiting |
| Payments | Lemon Squeezy (webhook at `/api/lemon`) |
| Push | Web Push (VAPID) |

## Project layout

```
src/            Worker: API, Durable Objects, auth, billing, email, push, i18n
web/src/pages/  One React entry per page: home, pricing, join, host, status, admin, privacy, terms
web/public/     Service worker, manifest, icons
redirect/       Separate Worker: 301 from the old sirangeldi.com domain to qrwait.app
smoke.mjs       End-to-end smoke test against a running dev server
wrangler.jsonc  Worker config: bindings, routes, vars, ticket packages
```

Code comments are in Turkish.

## Development

Requires Node.js 24.

```sh
npm install
npm run dev        # wrangler dev on http://localhost:8787 (builds the UI first)
npm run dev:ui     # optional: Vite with hot reload, proxies /api to the Worker
```

Create `.dev.vars` for local secrets:

```ini
ADMIN_PASSWORD=test          # super admin, username "admin"
DEV=1                        # log email links instead of sending, no list caching
LEMON_TEST=1                 # accept Lemon Squeezy test orders
LEMON_WEBHOOK_SECRET=test-webhook-secret
TURNSTILE_SITE_KEY=1x00000000000000000000AA      # Turnstile always-pass test keys
TURNSTILE_SECRET=1x0000000000000000000000000000000AA
VAPID_PRIVATE_KEY=...        # optional; without it push sending is skipped
```

User pages also work on subdomains of localhost, e.g. `http://antalyabb.localhost:8787`.

### Smoke test

With `npm run dev` running:

```sh
npm run smoke                              # or, to include the password reset flow:
WRANGLER_LOG=wrangler.log node smoke.mjs
```

`WRANGLER_LOG` points to the `wrangler dev` output so the password reset flow can read email links; without it that part is skipped. Login is limited to 10 requests per minute per IP, so wait a minute between consecutive runs.

## Deployment

Every push to `main` runs the smoke test on GitHub Actions and, if it passes, deploys to Cloudflare ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

- Repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Worker secrets (`wrangler secret put`, untouched by deploys): `ADMIN_PASSWORD`, `VAPID_PRIVATE_KEY`, `TURNSTILE_SECRET`, `LEMON_API_KEY`, `LEMON_WEBHOOK_SECRET`.

The `redirect/` Worker is not deployed by CI; run `npx wrangler deploy` in that folder after changing it.
