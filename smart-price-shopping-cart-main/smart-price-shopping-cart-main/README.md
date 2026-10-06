# Shopping Cart

A shopping cart demo app built with **Node.js, Express, EJS, and SQLite** (via the built-in `node:sqlite` module — no native dependencies). Server-rendered HTML/CSS/JS — no client-side framework or build step. Multi-user accounts, a real cart/checkout flow, and order history are all persisted server-side, replacing an earlier fully client-side/`localStorage` version of this app.

## Features

- **Category browsing** — six product categories (mobiles, watches, laptops, shoes, clothes, electronics), rendered from one shared template and driven by data in SQLite
- **Login first** — the whole store is behind login; visitors land on `/login` (or `/signup`) and are sent back to the page they asked for after signing in
- **Search** — `/search?q=` matches product names, brands, descriptions and category words ("phone", "sneakers", "wireless"); every word must match, so "black shoes" narrows results
- **Sorting** — category and search pages sort by price (low/high), biggest 30-day price drop, or rating
- **Accounts — passwordless, mobile OTP** — sign up and log in with just a mobile number and a one-time code texted to it (see [SMS delivery](#sms-delivery) below); sessions are cookie-based (`httpOnly`)
- **Cart** — add products (quantity increments if already in the cart), adjust quantities, remove items, see live totals — requires login
- **Buy Now** — an instant one-item checkout on each product card, separate from the cart
- **Checkout & Orders** — cart checkout turns the cart into a real order (with a line-item snapshot) and clears the cart; `/orders` shows full order history for both cart checkouts and Buy Now purchases
- Toast notifications instead of `alert()` for feedback
- **Smart Price Alert** — set a target price on any product (`/product/:id`, the category cards, or `/price-alerts`); you get an in-app notification (header badge + toast) and an SMS the moment the price reaches it
- **Price History** — every product page charts its price over 7 / 30 / 90 days with lowest / highest / average, and category cards show a 30-day sparkline
- **AI Price Prediction** — a damped Holt trend forecast over the price history predicts prices 1–4 weeks out (with a range), estimates when your target is likely to be hit ("expected target range in 2–3 weeks"), and gives a buy-now / wait verdict. These are statistical estimates, not guarantees

## Price data

There is no real price feed behind this demo, so `services/priceSimulator.js` moves prices over time (small random steps pulled back toward each product's recent average, plus occasional sale-style jumps) and records each change in the `price_history` table. Each product also gets 90 days of deterministic seeded history on first run.

- `PRICE_SIMULATOR=off` — stop prices from changing on their own
- `PRICE_TICK_SECONDS=60` — how often prices update (default 60, minimum 5)

To connect a real source, call `products.setPrice(id, price)` (`models/products.js`) whenever a price changes; alerts, history and predictions all follow from that.

## Running locally

Requires Node.js 22+ (built with Node 24; uses `node:sqlite`, currently an experimental core module — you'll see an `ExperimentalWarning` on startup, which is expected).

```bash
npm install
npm start
```

Then visit `http://localhost:3000` (override the port with the `PORT` env var). The SQLite database (`db/shop.db`) and product catalog are created and seeded automatically on first run.

## SMS delivery

No SMS provider is wired up yet. Until one is, `services/sms.js` runs in **stub mode**: OTPs are logged to the server console (`[SMS STUB] would text ...`) instead of actually being texted, and the API responses for `/api/auth/*/request-otp` include a `demoOtp` field so you can still test signup/login end-to-end without a real phone. **`demoOtp` disappears from the response automatically once a real provider is configured** — see below.

To send real SMS:

1. Pick a provider (Twilio and MSG91 are both documented as examples in `services/sms.js`) and create an account with them.
2. `npm install twilio` (or that provider's SDK).
3. Set `SMS_PROVIDER` (e.g. `SMS_PROVIDER=twilio`) plus that provider's credentials as environment variables (e.g. `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`).
4. Implement that provider's branch in `services/sms.js` — `sendOtp(mobile, otpCode)` is the one function every auth route calls; nothing else needs to change.

## Running with Docker

```bash
docker build -t shopping-cart .
docker run -p 3000:3000 -v shopcart-data:/app/db shopping-cart
```

The named volume (`shopcart-data`, mounted at `/app/db`) keeps the SQLite database outside the container so data survives container restarts/recreation. Pass `-e SMS_PROVIDER=... -e TWILIO_...=...` etc. once a real SMS provider is configured.

## CI

A `Jenkinsfile` is included with a pipeline that checks out the repo, runs `npm ci`, and builds the Docker image (`docker build`). It does not push to a registry or deploy anywhere — wire those up once you have a target registry/host. There's no automated test suite yet, so there's no test stage.

## Project structure

```
server.js              Express app entry point
db/                     schema.sql, database.js (connection + migrations), seed.js (product catalog)
services/sms.js         Swappable SMS sender (console stub until a real provider is configured)
services/prediction.js  Price forecasting (damped Holt trend) + time-to-target estimate
services/insights.js    Builds history / stats / prediction / verdict for a product
services/priceSimulator.js  Simulated price feed (see "Price data")
middleware/auth.js      Session/cookie auth (attachUser, requireAuth)
models/                 Query wrappers: users, sessions, otps, products, cart, orders
routes/
  pages.js               Server-rendered pages (home, category, login, signup, cart, orders)
  auth.js                 JSON API: signup/login OTP request+verify, logout, me
  cart.js                 JSON API: cart CRUD
  orders.js                JSON API: checkout, buy-now
views/                  EJS templates (partials/header.ejs, partials/footer.ejs, category.ejs, etc.)
public/css/style.css    Shared stylesheet (design tokens, one consistent theme)
public/js/main.js       Shared client JS: header state, search, add-to-cart, buy-now, toasts, cart/checkout page logic
images/, *.png          Product and logo images (unchanged from the original static site)
Dockerfile, .dockerignore, Jenkinsfile
```

## Notes

- Cart requires being logged in — there's no anonymous/guest cart.
- There's no password anywhere in this app — a verified mobile number **is** the account. Signing up requires verifying the mobile via OTP before the account is created; logging in is request-OTP → verify-OTP. Each OTP is single-use and expires after 10 minutes.
- No automated test suite exists yet — testing is currently manual (signup via OTP → login via OTP → browse → add to cart / buy now → adjust/remove cart items → checkout → view orders → logout → restart server and confirm data persists).
