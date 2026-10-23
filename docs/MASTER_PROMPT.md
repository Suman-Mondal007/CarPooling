# PROJECT: Enterprise Carpooling Platform (MERN) — Master Prompt v2

You are acting as a senior full-stack MERN engineer, software architect, UI/UX designer, and QA engineer. Build a complete, production-minded **Enterprise Carpooling Platform** based on the requirements PDF (expected at `docs/Carpooling_Platform.pdf`; if it is missing, rely on this document and mention it once in your first report).

This must be a real application: React frontend, Node/Express backend, MongoDB persistence, real authentication, real-time sockets, maps, sandbox payments, and tests. No fake API responses, no local-array backends, no static mockups.

---

## 0. WORKING RULES (read first)

1. **Phases.** Work strictly in the phases of Section 22. Inspect the workspace, then start Phase 1 immediately. After each phase: run lint, tests and build, make a git commit (`phase-N: <summary>`), update `PROJECT_STATE.md`, **then STOP** and give a short report. Wait for me to say "continue" before starting the next phase.
2. **`PROJECT_STATE.md`** (repo root) is your memory across sessions. Keep it current with: completed phases, key decisions, folder map, exact commands (install, dev, seed, test, build), env variables, known issues, and the next step. At the start of any new session, read it first.
3. **Verify before claiming.** Never say a feature works, or a test or build passed, unless you actually ran it. Report failures honestly.
4. **Do not guess library APIs or versions.** Check with `npm view <pkg> version`, use mutually compatible versions, pin them in `package.json`, and confirm with a real build. Prefer official docs over memory.
5. **Stay in scope.** Implement what this document asks. Do not add unrequested features. Record deliberate omissions in the README under "Known limitations".
6. **Ask me only when truly blocked** (for example missing credentials). Otherwise choose a sensible default, document it, and continue.
7. **Honesty about simulation.** Anything seeded, simulated, or sandboxed must be labeled as such in the UI and the README.

---

## 1. TECHNOLOGY STACK (fixed decisions)

Use JavaScript throughout (ES modules, `"type": "module"`). Do not switch stacks.

**Frontend**
- React 18 + Vite, JSX.
- React Router DOM v6.
- Tailwind CSS v4 using the `@tailwindcss/vite` plugin (no legacy v3 config).
- Axios, React Hook Form + Zod (use a matching `@hookform/resolvers` major version).
- React Context for auth and notifications.
- Leaflet 1.9 + react-leaflet v4 (compatible with React 18), OpenStreetMap tiles. Import Leaflet CSS and fix the default marker icons for Vite bundling.
- Socket.IO client, Recharts, Lucide React, a toast library (e.g. react-hot-toast).
- Vitest + React Testing Library for a few key components.

**Backend**
- Node.js (LTS), Express 4, Mongoose.
- JWT, bcrypt (or bcryptjs), Zod for request validation (same library as the frontend).
- helmet, cors (single exact origin, credentials on), cookie-parser, express-rate-limit, morgan.
- Socket.IO.
- Razorpay Node SDK in **test mode**.
- Nodemailer for password-reset email (see Section 6).
- swagger-ui-express serving an OpenAPI document at `/api/docs`.
- Vitest + Supertest + `mongodb-memory-server` (use the replica-set variant) for tests.

**Tooling**
- npm workspaces or a root `package.json` with scripts: `dev` (client + server via concurrently), `seed`, `test`, `lint`, `build`.
- ESLint (flat config), nodemon, dotenv.
- Dockerfile(s) + `docker-compose.yml` (MongoDB, server, client).
- GitHub Actions workflow `.github/workflows/ci.yml` running install, lint, test, build.

**Database**: MongoDB. Recommend Atlas free tier or a local single-node replica set in the README. The code must NOT depend on transactions (see Section 10); use them only as an optional enhancement.

---

## 2. FIRST: INSPECT THE WORKSPACE

Before writing code:
1. List all existing files and folders. Identify whether a project already exists.
2. Preserve useful existing code and configuration; do not overwrite working files unnecessarily.
3. Check installed tool versions (Node, npm, git) and note missing prerequisites.
4. Write a short plan, then begin Phase 1 right away. Do not stop after the plan.

If the workspace is empty, scaffold from scratch.

---

## 3. CORE DOMAIN DECISIONS (do not deviate)

**Conventions**
- Money: integer **paise** (minor units), currency `INR`. Forms accept rupees; convert at the boundary.
- Time: store UTC `Date`. Display in the organization's timezone (default `Asia/Kolkata`).
- Coordinates: API uses `{ lat, lng }`. MongoDB stores **GeoJSON** `{ type: "Point", coordinates: [lng, lat] }` (longitude first) with `2dsphere` indexes. Convert at the API boundary. Validate ranges (lat −90..90, lng −180..180).
- API response envelope: `{ success, data, error: { code, message, details } }`; lists return `{ items, page, limit, total }`.
- Each organization is a tenant. All rides, bookings, vehicles and chats are visible only within the user's own organization. No cross-organization ride sharing.

**Entities and their roles**
- **Ride** = a driver's published offer for ONE dated departure. Fields: organization, driver, vehicle, origin and destination (address + GeoJSON point), `routeGeometry` (GeoJSON LineString, simplified to ≤ 300 points), `distanceMeters`, `durationSeconds`, `departureAt`, `totalPassengerSeats`, `availableSeats`, `farePerSeatMinor`, notes, `recurrenceGroupId` (optional), `isSeeded`. Status: `OPEN | CANCELLED | CLOSED` (`CLOSED` once the trip has started or finished). "Full" is derived from `availableSeats === 0`.
  - `totalPassengerSeats ≤ vehicle.seatingCapacity − 1` (the driver's seat is not available).
  - A ride is **bookable** only if: status `OPEN`, `availableSeats > 0`, `departureAt` is in the future, and its Trip is `SCHEDULED`.
- **Booking** = one passenger's reservation on one ride. Bookings are **instant** (no driver approval step). Fields: ride, passenger, organization, `seats`, passenger pickup and drop points, `fareTotalMinor` (computed server-side as `seats × ride.farePerSeatMinor`, snapshot at booking time), `lateCancellation` flag. Status: `CONFIRMED | CANCELLED_BY_PASSENGER | CANCELLED_BY_DRIVER | COMPLETED`. Payment status: `UNPAID | PAYMENT_PENDING | PAID`.
- **Trip** = the execution record of a Ride (exactly one per Ride, created together with the Ride). Status: `SCHEDULED → STARTED → IN_PROGRESS → COMPLETED`, or `SCHEDULED → CANCELLED`. `STARTED` = driver pressed Start. `IN_PROGRESS` = set automatically when the first valid location update from the driver is accepted. Fields: `startedAt`, `completedAt`, `lastKnownLocation`, `lastLocationAt`.
- **TrackingPoint** = location breadcrumbs for a trip, with a TTL index (auto-delete after 7 days) for privacy.
- **Passenger-facing lifecycle (derived, not stored)** shown as a stepper: *Ride Booked* → *Trip Started* → *Trip In Progress* → *Trip Completed* → *Payment Pending* → *Payment Completed*, computed from Trip status and Booking payment status. Payment is per passenger, never per trip.

**Cancellation rules** (configurable per organization)
- Passenger may cancel while the Trip is `SCHEDULED`. If within `cancellationCutoffMinutes` (default 60) of departure it is allowed but flagged `lateCancellation: true` and counted in reports. No monetary penalty (payment happens only after the trip completes, so no refunds are needed). Seats are returned atomically.
- Driver may cancel a ride only while `SCHEDULED`: all active bookings become `CANCELLED_BY_DRIVER` and passengers are notified.
- No cancellation after `STARTED`.

**Fares**: flat `farePerSeat` per ride, regardless of where a passenger boards or exits (no proration). The passenger's own pickup and drop points are stored for matching and display.

---

## 4. PROJECT STRUCTURE

Use this structure. Adjust names only with a clear technical reason.

```
carpooling-platform/
  client/
    src/
      api/            axios.js (with refresh interceptor), auth.api.js, rides.api.js,
                      bookings.api.js, vehicles.api.js, trips.api.js, payments.api.js,
                      wallet.api.js, admin.api.js, geo.api.js, chat.api.js,
                      notifications.api.js, reports.api.js, places.api.js
      components/     common/, layout/, forms/, maps/ (MapPicker, RouteMap),
                      rides/, trips/, charts/
      context/        AuthContext.jsx, NotificationContext.jsx, RideDraftContext.jsx
      hooks/          useSocket, useGeolocation, useDebounce, ...
      layouts/        PublicLayout, EmployeeLayout, AdminLayout
      pages/
        public/       SplashScreen, LandingPage, LoginPage, RegisterPage,
                      ForgotPasswordPage, ResetPasswordPage
        employee/     DashboardPage, FindRidePage, OfferRidePage,
                      RouteConfirmationPage (shared; mode = find | offer),
                      AvailableRidesPage, RideDetailsPage, BookingConfirmationPage,
                      MyTripsPage, TripDetailsPage, TripTrackingPage,
                      VehiclesPage, PaymentPage, WalletPage, RideHistoryPage,
                      SavedPlacesPage, ChatPage, NotificationsPage,
                      EmployeeReportsPage, ProfilePage, SettingsPage, HelpSupportPage
        admin/        AdminDashboardPage, EmployeesPage, AdminVehiclesPage,
                      RideMonitoringPage (read-only), ReportsPage,
                      OrganizationSettingsPage
        NotFoundPage.jsx
      routes/         AppRoutes.jsx, ProtectedRoute.jsx
      utils/, App.jsx, main.jsx, index.css
    .env.example, package.json, vite.config.js (dev proxy for /api and /socket.io)

  server/
    src/
      config/         db.js, env.js (validates env at startup)
      controllers/    one per module
      middleware/     authenticate, authorize, validate, organizationScope,
                      rateLimiters, errorHandler, notFound
      models/         Organization, User, RefreshSession, Vehicle, Ride, Booking,
                      Trip, TrackingPoint, Payment, Wallet, WalletTransaction,
                      SavedPlace, Message, Notification
      routes/
      services/       matching, routing, geocoding, payment, wallet, tracking,
                      analytics, recurrence, notification, mail
      sockets/        index.js, tracking.socket.js, chat.socket.js, notification.socket.js
      utils/          geo.js (haversine, point-to-polyline, simplify), money.js, asyncHandler.js
      seed/           seed.js
      openapi.yaml
      app.js, server.js
    tests/
    .env.example, package.json, Dockerfile

  docker-compose.yml
  .github/workflows/ci.yml
  docs/               MASTER_PROMPT.md, Carpooling_Platform.pdf
  PROJECT_STATE.md, README.md, .gitignore, package.json
```

Create working implementations, not empty placeholder files.

---

## 5. DESIGN AND UX

Modern, polished enterprise product, not a basic CRUD demo.
- Light backgrounds, dark navy/charcoal text, green/teal accents (sustainability).
- Consistent spacing, typography, rounded cards, subtle shadows.
- Responsive for desktop, tablet and mobile.
- Accessible: labels, keyboard navigation, focus states, readable contrast.
- Empty states, skeleton loaders, confirmation dialogs, helpful error messages, toasts.
- Realistic sample data only where explicitly seeded.

**Splash screen**: a brief branded splash shown while the session is restored, then redirect to login or dashboard.

**Landing page**: logo and navigation; hero explaining employee carpooling; prominent **Find a Ride** and **Offer a Ride** actions; How It Works; benefits; sustainability and cost-saving statistics (clearly labeled illustrative); Login and Sign Up buttons; footer with Help, Support and Terms links.

**Employee dashboard** must show TWO prominent, equally clear actions: **Find / Book a Ride** and **Offer / Share a Ride**. Both are reachable from the landing page, dashboard, navigation menu, and mobile screens. One account does both; there are no separate passenger and driver accounts. The dashboard also shows upcoming trips, wallet balance, and unread notifications.

**Profile dropdown** (every authenticated layout): My Profile, My Trips, My Vehicles, Wallet, Settings, Logout.

---

## 6. AUTHENTICATION AND SESSIONS

**Registration**: full name, work email, phone (+91 validation), password and confirm password, **organization registration code** (not a public organization list, which would leak tenants), employee ID (required if the organization says so), terms agreement.
- New accounts get status `PENDING_APPROVAL` unless the organization's `autoApproveEmployees` is true (default false). Only `ACTIVE` users can log in; give clear messages for pending, suspended, and deactivated states.
- The admin approves, suspends or deactivates employees (Section 7).

**Tokens and sessions**
- Short-lived **access token** (15 min), kept **in memory only** (React state / module variable). Never in localStorage or sessionStorage.
- **Refresh token** (7 days), rotating, in an `HttpOnly` cookie scoped to `/api/auth`. `Secure` in production; `SameSite=Lax` (or `None; Secure` only if cross-site is unavoidable).
- Store refresh sessions **hashed** in a `RefreshSession` collection with a token-family ID. On reuse of an old refresh token, revoke the whole family.
- CSRF protection for the refresh and logout endpoints: SameSite cookie, Origin check, and a custom request header.
- Axios interceptor: on 401, call refresh once (single-flight lock so parallel requests share one refresh), retry the original request, and log out if refresh fails.
- Session persistence across reloads: call refresh on app start, with a loading state (the splash screen).
- Logout invalidates the refresh session on the backend, clears the cookie, and clears client state. Logout works from every layout.
- bcrypt password hashing; unique email index; validate email and password strength; never leak whether an email exists on login or forgot-password.
- Rate-limit login, register, forgot-password and reset-password.

**Forgot / reset password**: generate a random token, store only its hash with an expiry, single use. In development, log the reset link to the server console when SMTP is not configured; if SMTP env vars are present, send via Nodemailer. Document this in the README.

**Redirects**: employees go to `/dashboard`; company admins go to `/admin`.

**Deployment note** (put in README): to keep cookies first-party, serve the client and API under the same site (reverse proxy, or a Vercel rewrite from `/api` and `/socket.io` to the backend). Note that browser geolocation requires HTTPS outside localhost.

---

## 7. ROLES AND ORGANIZATIONS

Roles: `EMPLOYEE`, `COMPANY_ADMIN`. Each user belongs to exactly one organization.

**Company admin can**:
- Approve, suspend, deactivate and reactivate employees of their organization; view driver information (licence number).
- View organization vehicles and **verify or reject** them.
- Configure organization settings: fuel price per litre, optional operational cost per km, `cancellationCutoffMinutes`, `autoApproveEmployees`, `requireVehicleVerification`, timezone, employee-ID requirement, and regenerate the registration code.
- Monitor employee participation and view organization-level reports and a **read-only** ride overview.

**Company admin cannot**: act as driver or passenger in day-to-day ride operations, and **cannot read chat messages**. Admins are configuration and monitoring only.

**Security rules**
- Every organization-scoped query is filtered by the authenticated user's organization on the server (`organizationScope` middleware).
- Never trust role, organization ID, fare, seats-remaining, or ownership supplied by the client.
- Provide a **development-only seed** that creates a demo organization, a company admin and sample employees using env-supplied credentials (`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`). The seed script must refuse to run when `NODE_ENV=production`. Mark seeded records with `isSeeded: true`.

---

## 8. MAPS, GEOCODING AND ROUTING

- Leaflet + react-leaflet + OpenStreetMap tiles. Tile URL and attribution configurable via env; show attribution.
- Build reusable **MapPicker** (search, click-to-select, pickup/destination markers) and **RouteMap** (markers, route polyline, distance, duration, zoom/pan).
- **Server-side proxies** (the client never calls third-party geo services directly):
  - `GET /api/geo/search?q=` (geocoding), `GET /api/geo/reverse?lat=&lng=`
  - `POST /api/geo/route` (route between two points; returns geometry, distance, duration)
- Providers are configurable behind a service abstraction (default: Nominatim for geocoding, OSRM for routing). **Respect usage policies**: Nominatim allows at most 1 request/second, requires an identifying `User-Agent`, and forbids per-keystroke autocomplete. Therefore: debounce at least 600 ms, require at least 3 characters, cache results, throttle server-side, and make the provider URL replaceable (Photon, Geoapify, self-hosted, etc.). The public OSRM demo server is for light use only. State all limits in the README.
- Handle provider failures gracefully: friendly message plus retry. Never fabricate a route; a ride cannot be published without a real route.
- Never hardcode a single route.
- Save a simplified route polyline (≤ 300 points) on each Ride; route distance and duration come from the routing provider.

---

## 9. USER JOURNEYS

### A. Find / Book a Ride (`/find-ride` → `/find-ride/confirm-route` → `/rides` → `/rides/:id` → booking)
1. Search form: pickup, destination, date, preferred departure time or window, seats required, optional recurring preference.
2. Location autocomplete (within the policy limits above), map selection, and saved-place selection.
3. Show markers, route polyline, distance, duration. **Route confirmation** screen lets the user confirm or edit. (Draft state may use `sessionStorage` for non-sensitive form data.)
4. Search matching rides (Section 10). Ride cards show: driver name/profile, rating **only if real rating data exists**, vehicle model and registration, pickup/destination, departure, route preview, available seats, fare per seat, distance/duration.
5. Ride details page; choose seats; book. The server validates availability and rules; prevent overbooking, duplicate active bookings, booking your own ride, and overlapping commitments.
6. Show booking confirmation only after the server confirms. The trip appears in **My Trips**; the driver is notified. Never show a fake success when the request fails.
7. **Recurring search**: the user picks weekdays; results show matching dated instances grouped by day; "Book all selected" books each instance independently and reports per-instance success or failure.

### B. Offer / Share a Ride (`/offer-ride` → `/offer-ride/confirm-route` → publish)
1. Check the user has at least one vehicle (and a verified one if the organization requires it). If not, redirect to **My Vehicles** with an explanation.
2. Form: pickup, destination, date, departure time, vehicle, available passenger seats (≤ capacity − 1), fare per seat, optional recurring schedule, optional notes. Location search, map and saved places as above.
3. Show route, distance, duration, markers; **route confirmation**; allow edits before publishing.
4. Server validates vehicle ownership, seat capacity, fare, future date, coordinates, and that the driver has no overlapping ride.
5. Publish: save Ride and Trip in MongoDB. Show success only after server confirmation. The ride appears in the **Offered** tab of My Trips.
6. **Recurring rides** are generated as separate dated Ride instances (default horizon 4 weeks, configurable) sharing a `recurrenceGroupId`. Never create one "permanent" ride.
7. Driver can view passengers and booking statuses, reduce remaining seats (never below booked seats), and cancel an eligible ride.

---

## 10. RIDE MATCHING AND BOOKING INTEGRITY

**Matching** (server-side, `matching.service.js`). A ride matches when:
- It belongs to the user's organization and is bookable (Section 3), and the requested seats fit.
- Departure falls within the requested window (default ±30 min, configurable).
- The passenger's pickup is within a configurable distance of the ride's route (default 2 km), the drop is also within it, and the **pickup comes before the drop along the route direction**. Use a `2dsphere` query on origin for pre-filtering plus point-to-polyline distance on the stored geometry. Never rely on exact string equality of addresses.
- The passenger is not the driver and has no conflicting booking or offered ride.

**Ranking** (documented, explainable): pickup proximity, route compatibility, time difference, seats, fare.

**Seat reservation without transactions** (must be safe under concurrency):
- Reserve with a single atomic update:
  `Ride.findOneAndUpdate({ _id, organization, status: "OPEN", availableSeats: { $gte: n }, departureAt: { $gt: now } }, { $inc: { availableSeats: -n } })`.
  Then create the Booking; if that fails, run a compensating `$inc`. Use a transaction as an optional wrapper only when available.
- Partial unique index on `(ride, passenger)` where booking status is `CONFIRMED` to prevent duplicates.
- Cancellation returns seats with an atomic `$inc`, only once per booking (guard on booking status).
- A search result never guarantees seats; availability is re-checked at booking.

---

## 11. TRIPS AND LIVE TRACKING

**My Trips** tabs/filters: Upcoming, Booked by me, Offered by me, Active, Completed, Cancelled.

**Trip details** show: driver info; passengers (visible to the driver, and passenger names visible to co-passengers only as the organization policy allows); vehicle; pickup/destination; schedule; route and distance; fare per seat and total; seats; booking status; trip status; payment status; tracking map when active.

**State transitions are enforced server-side**: only the driver can start or complete; `SCHEDULED → STARTED → IN_PROGRESS → COMPLETED`; no starting a cancelled trip; no completing twice; no starting a trip with no confirmed bookings (configurable). Completing a trip marks CONFIRMED bookings `COMPLETED` with payment `UNPAID`→ready to pay, and notifies passengers.

**Socket.IO tracking**
- Authenticate the socket handshake with the access token (`handshake.auth.token`). On token expiry the client refreshes and reconnects.
- Rooms: `trip:<id>` (join only after a DB check that the user is the driver or a confirmed passenger) and `user:<id>` (notifications).
- `driver:location` events: validate the sender is the trip's driver, trip status is `STARTED` or `IN_PROGRESS`, coordinates are valid, and throttle (about one update per 3–5 s). First accepted update moves the trip to `IN_PROGRESS`. Save `lastKnownLocation` and TrackingPoints (TTL).
- ETA: computed server-side from the last location to the destination via the routing service, refreshed at most every 30–60 s and cached (not on every ping).
- Stop sharing immediately when the trip is completed or cancelled. Mark locations as stale if no update for a configured time and show that in the UI.
- Handle disconnects and rejoin automatically; the passenger page loads `lastKnownLocation` on open.
- Browser geolocation with explicit permission; show a clear explanation if denied. A development **simulator** is allowed only if clearly labeled "Simulated tracking" and disabled in production.

**Tracking page**: map with driver marker, pickup and destination markers, current route, ETA, status stepper, driver/passenger info, vehicle info, chat entry point, and a **Call** action implemented as a real `tel:` link to the other participant's verified phone number (no fake in-app calling).

---

## 12. VEHICLES

**My Vehicles**: add, edit, view, delete (blocked if used by an active or future ride), and select when offering a ride.

Fields: model, registration number, vehicle type, **seating capacity**, color (optional), image (optional), **fuel type**, **fuel efficiency in km/l** (needed for reports), owner, organization, verification status (`PENDING | VERIFIED | REJECTED`).

Rules:
- Validate Indian registration numbers (accept a standard format such as `KA01AB1234` and the BH-series, normalizing spaces and hyphens) and enforce uniqueness per organization.
- Enforce ownership server-side.
- Distinguish total seating capacity from seats available to passengers.
- Block a vehicle from overlapping rides. If `requireVerificationForRides` is on, only verified vehicles can publish.
- Keep history intact if a vehicle is later removed (soft delete).

Driver details: optional driving licence number (and expiry) on the user profile, visible to the company admin.

---

## 13. CHAT AND NOTIFICATIONS

**Chat**
- Real-time via Socket.IO; messages persisted in MongoDB and tied to a Trip.
- Only the trip's driver and its confirmed passengers can read or send messages. **Admins cannot access chat content.**
- Show sender, timestamp, delivery state where practical, empty states, loading states. A Chat page lists conversations per trip.

**Notifications** (stored in MongoDB, pushed over the socket, read/unread state, dropdown + `/notifications` page):
booking created (driver), booking cancelled (driver/passenger), ride cancelled, trip started, trip completed, payment pending, payment completed, relevant ride updates.

Optional: notify employees with saved matching routes when a relevant ride is published (bonus).

---

## 14. PAYMENTS AND WALLET (sandbox only)

Never process real money. Every payment screen shows a visible "Test mode" label.

**Methods**: Cash, Card (Razorpay test checkout), UPI (Razorpay test checkout, e.g. its documented test UPI IDs), Wallet.

**Flow** (per booking, after the trip is completed)
1. Server computes the payable amount (`booking.fareTotalMinor`); the client never sends the amount.
2. Passenger sees a summary and picks a method.
3. A `Payment` record is created (`CREATED`).
4. **Card/UPI**: create a Razorpay order on the server, open checkout on the client, then **verify the signature on the server** (HMAC-SHA256 of `order_id|payment_id` with the key secret) before marking `PAID`. Optionally support the Razorpay webhook as a second confirmation path.
5. **Wallet**: atomic debit `Wallet.findOneAndUpdate({ _id, balanceMinor: { $gte: amount } }, { $inc: { balanceMinor: -amount } })`; fail cleanly on insufficient balance.
6. **Cash**: payment becomes `PENDING_CASH_CONFIRMATION`; the **driver** confirms receipt; then `PAID`.
7. Prevent duplicates: unique partial index allowing only one `PAID` payment per booking; an `idempotencyKey` (unique) on payment attempts and `WalletTransaction`s; replayed requests return the original result.
8. On `PAID`, update the booking payment status, notify both parties, and show a receipt.

**Wallet ledger**
- `WalletTransaction` entries: type (`RECHARGE | PAYMENT | EARNING`), amount, balance-after, reference, idempotency key. The ledger is append-only and auditable; balances are never set directly by the client.
- Recharge via a Razorpay test order and verification. If no Razorpay keys are configured, show a truthful "payments not configured" message; a clearly labeled **simulated recharge** is allowed only when `NODE_ENV !== "production"` and `ALLOW_SIMULATED_PAYMENTS=true`.
- When a passenger's non-cash payment succeeds, credit the **driver's wallet** with an `EARNING` entry (internal ledger only; no withdrawals/payouts in scope). Cash payments make no wallet movement.
- "Payment Methods" in Settings stores only the user's default preferred method; **never store card details**.

---

## 15. HISTORY, SAVED PLACES, SETTINGS

**Ride History**: completed and cancelled trips with trip ID, participants (as appropriate), route, date/time, vehicle, distance, fare, payment status, trip status. Search, filters, sorting, pagination. Based on real records; history survives vehicle removal.

**Saved Places**: Home, Office and custom places (label, address, lat, lng); add, edit, delete; selectable from Find and Offer forms.

**Settings**: profile, notification preferences, payment-method preference, saved places, Help & Support (static help content plus a support contact form that stores the request), security (change password, logout), and quick links: My Trips, My Vehicle, Payment Methods, Ride History, Saved Places, Help & Support, Chat.

---

## 16. REPORTS AND ANALYTICS

Charts (Recharts), summary cards, tables, date-range filters.

**Metrics**: total trips, completed, cancelled (and late cancellations), total distance, total bookings, total travel cost, fuel consumption estimate, cost per km, vehicle-wise cost analysis, fuel-efficiency trend, employee participation.

**Formulas** (define in code comments and README; label every estimate as an estimate):
- Distance = sum of stored route distance of completed trips.
- Fuel litres = distance (km) ÷ vehicle `fuelEfficiencyKmpl`.
- Fuel cost = litres × organization `fuelPricePerLitre` (+ optional operational cost per km × distance) = total travel cost.
- Cost per km = total travel cost ÷ distance.
- Fuel-efficiency trend = monthly **fuel per passenger-km** (improves as occupancy rises); also show average occupancy per trip.
- Optional CO₂ saved estimate, clearly labeled with its assumption.

Employees see only their own statistics (as driver and as passenger). Company admins see organization-level analytics. Never fabricate measured consumption; everything is computed from stored records.

---

## 17. REST API (target endpoints)

These are targets; add what is necessary. Use proper status codes, Zod validation, pagination, filtering, the response envelope, and centralized error handling. Document everything in `openapi.yaml` served at `/api/docs`.

- **Health**: `GET /api/health`
- **Auth**: `POST /api/auth/register | login | refresh | logout | forgot-password | reset-password`, `GET /api/auth/me`
- **Users/Org**: `GET|PATCH /api/users/me`, `GET /api/organizations/me`
- **Geo**: `GET /api/geo/search`, `GET /api/geo/reverse`, `POST /api/geo/route`
- **Vehicles**: `GET|POST /api/vehicles`, `GET|PATCH|DELETE /api/vehicles/:id`
- **Rides**: `GET /api/rides/search`, `GET|POST /api/rides`, `GET|PATCH /api/rides/:id`, `POST /api/rides/:id/cancel`
- **Bookings**: `POST /api/bookings`, `GET /api/bookings/my`, `GET /api/bookings/:id`, `POST /api/bookings/:id/cancel`
- **Trips**: `GET /api/trips/my`, `GET /api/trips/:id`, `POST /api/trips/:id/start`, `POST /api/trips/:id/complete`, `GET /api/trips/:id/tracking`
- **Payments**: `GET /api/payments/my`, `POST /api/payments/create-order`, `POST /api/payments/verify`, `POST /api/payments/wallet-pay`, `POST /api/payments/:id/cash-confirmation` (driver only)
- **Wallet**: `GET /api/wallet`, `GET /api/wallet/transactions`, `POST /api/wallet/recharge`, `POST /api/wallet/recharge/verify`
- **Saved places**: CRUD under `/api/saved-places`
- **Chat**: `GET /api/trips/:id/messages` (+ socket events)
- **Notifications**: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `POST /api/notifications/read-all`
- **History/Reports**: `GET /api/history`, `GET /api/reports/me`
- **Support**: `POST /api/support`
- **Admin** (company admin only): `GET /api/admin/employees`, `PATCH /api/admin/employees/:id/status`, `GET /api/admin/vehicles`, `POST /api/admin/vehicles/:id/verify`, `GET /api/admin/rides`, `GET|PATCH /api/admin/settings`, `GET /api/admin/reports`

---

## 18. FRONTEND ROUTES AND GUARDS

**Public**: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`

**Employee**: `/dashboard`, `/find-ride`, `/find-ride/confirm-route`, `/rides`, `/rides/:id`, `/booking-confirmation/:bookingId`, `/offer-ride`, `/offer-ride/confirm-route`, `/vehicles`, `/my-trips`, `/trips/:id`, `/trips/:id/tracking`, `/trips/:id/pay`, `/wallet`, `/history`, `/saved-places`, `/chat`, `/notifications`, `/reports`, `/profile`, `/settings`, `/help`

**Admin**: `/admin`, `/admin/employees`, `/admin/vehicles`, `/admin/rides`, `/admin/reports`, `/admin/settings`

Route guards check authentication and role; unauthorized users are redirected appropriately; a NotFound page handles unknown routes. Frontend guards are convenience only; the backend enforces everything. Provide a responsive sidebar/navigation, breadcrumbs where useful, and the profile menu.

---

## 19. ENVIRONMENT AND CONFIGURATION

Create `.env.example` for client and server; never commit real secrets. The server validates required variables at startup and fails with clear messages.

**Server**: `NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, cookie settings, `GEOCODING_URL`, `MAP_ROUTING_URL`, `GEO_USER_AGENT`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `ALLOW_SIMULATED_PAYMENTS`, SMTP settings (optional), `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`.

**Client**: `VITE_API_URL` (or use the dev proxy), `VITE_MAP_TILE_URL`, `VITE_MAP_ATTRIBUTION`, `VITE_RAZORPAY_KEY_ID`.

If a third-party credential is missing, implement the integration structure and show a truthful configuration message until it is supplied.

**README must cover**: prerequisites, install, MongoDB setup (Atlas or local replica set), env setup, start commands, seeding, tests, map-provider limits, Razorpay test-mode setup, deployment note (same-site cookies, HTTPS for geolocation), Docker usage, architecture diagram (Mermaid), screenshots section, known limitations, troubleshooting.

---

## 20. SECURITY CHECKLIST

Password hashing; hashed refresh sessions with rotation and reuse detection; server-side role and organization authorization on every route; Zod validation on every request; no raw client objects in Mongo queries (prevent operator injection); rate limiting; helmet; exact-origin CORS; safe error responses (no stack traces or internals in production); payment signature verification; seat-reservation integrity; socket-room authorization on every sensitive event; coordinate validation; ownership checks for vehicles, rides, bookings, trips; no password hashes, refresh tokens, secrets or unnecessary personal data in responses.

---

## 21. TESTING, CI, DOCS

Write tests with Vitest + Supertest + `mongodb-memory-server`. At minimum, verify:
1. Registration (including pending approval).
2. Successful login.
3. Failed login.
4. Logout and refresh-session invalidation (and refresh reuse detection).
5. Protected-route access.
6. Employee vs. admin authorization.
7. Organization data isolation.
8. Vehicle creation and ownership.
9. Ride publication (including seat-limit rule and recurring instances).
10. Ride search and matching (including pickup-before-drop).
11. Route-confirmation workflow (service-level).
12. Booking and seat availability.
13. **Concurrent booking** (`Promise.all` of many requests; no overbooking).
14. Trip start and completion (valid and invalid transitions).
15. Tracking authorization (socket tests).
16. Wallet balance validation.
17. Duplicate-payment prevention and idempotency.
18. Ride history and report formula calculations.

Also add a few frontend tests (login form validation, route guard). Run lint, tests and the production build. Provide `openapi.yaml`, Docker Compose, and the CI workflow. **Do not claim a test passed unless it was actually executed.**

---

## 22. IMPLEMENTATION PHASES

Remember: after each phase, run lint/tests/build, commit, update `PROJECT_STATE.md`, **stop**, and wait for my "continue".

**Phase 1 — Foundation**: inspect workspace; scaffold structure; install and configure dependencies; DB connection; env validation; health endpoint; ESLint, Vitest setup, mongodb-memory-server harness; root scripts; initial CI workflow; `PROJECT_STATE.md`.

**Phase 2 — Design system and authentication**: Tailwind setup, reusable UI components, splash, landing, register, login, refresh/logout, forgot/reset password, AuthContext, axios refresh interceptor, protected routes, employee/admin layouts, org model with registration code, dev admin seed, auth/authorization tests.

**Phase 3 — Data models, vehicles, maps, offer a ride**: remaining Mongoose models and indexes; vehicles CRUD; saved places; geo proxy services; MapPicker and RouteMap; route confirmation; publish ride (with Trip) and recurring instances; My Offered Rides.

**Phase 4 — Find a ride and booking**: matching service; search UI and results; ride details; atomic booking; cancellation rules; My Trips; trip start/complete transitions; concurrency tests.

**Phase 5 — Real time**: Socket.IO auth and rooms; live tracking with ETA; chat; notifications (dropdown and page); tracking and socket authorization tests.

**Phase 6 — Payments and wallet**: Razorpay test integration with signature verification; wallet ledger; cash confirmation; driver earnings; idempotency; payment tests.

**Phase 7 — History, settings and administration**: ride history; settings and help; admin employees (approve, suspend), vehicle verification, organization settings, read-only ride monitoring; employee and admin reports with the formulas above.

**Phase 8 — Hardening and delivery**: complete the test list; responsive and accessibility pass; OpenAPI docs; Docker Compose; CI; README; seeded demo data (clearly marked); final report.

**Phase 9 (optional, only after acceptance)**: bonus features such as smarter ranking, route optimization, push notifications, in-app calling.

---

## 23. FINAL ACCEPTANCE CRITERIA

Complete only when:
- Find a Ride and Offer a Ride both work end to end.
- Registration, approval, login, session persistence and logout work; employees and admins reach the correct dashboards.
- Data is stored in and read from MongoDB; vehicles can be registered and rides published.
- Routes are selected, calculated, previewed and confirmed.
- Users can search and book rides; seats cannot be overbooked (proven by the concurrency test).
- Trips follow valid lifecycle states.
- Authorized participants can view live tracking; chat and notifications work (or documented limitations exist).
- Payments and wallet work safely in sandbox mode with signature verification and idempotency.
- History and analytics come from real stored records.
- Organization isolation and role checks are enforced by the backend.
- The app works on desktop and mobile; every major button and link has a working action.
- The project builds and its important tests pass.

---

## 24. FINAL REPORT (after the last phase)

Provide a concise report: files and modules created; features completed; environment variables to configure; exact commands to install and start; tests and builds **actually executed** with results; remaining limitations.

---

**Begin now: inspect the workspace, then implement Phase 1 only and stop after reporting.**
