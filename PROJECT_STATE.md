# Project State — Enterprise Carpooling Platform

## 1. Project Overview
- **Project**: Enterprise Carpooling Platform (MERN)
- **Architecture**: Multi-tenant enterprise carpooling web application (React 18 + Express 4 + MongoDB + Socket.IO)
- **Status**: Phase 9 (UI Polish and Micro-Interactions) Completed

---

## 2. Completed Phases

### Phase 1: Foundation (Completed)
- **Workspace Inspection**: Identified existing requirements documents (`docs/Carpooling_Platform.pdf`, `docs/MASTER_PROMPT.md`).
- **Git Repository**: Initialized empty git repository with `.gitignore`.
- **Project Architecture & Workspaces**: Structured monorepo using npm workspaces (`client/` and `server/`).
- **Dependencies Setup**: Pinned mutually compatible dependencies:
  - **Client**: React 18.3, Vite 6.2, Tailwind CSS v4 (`@tailwindcss/vite`), React Router DOM v6, Axios, React Hook Form + Zod, Leaflet 1.9 + React Leaflet 4, Socket.IO Client, Recharts, Lucide React, React Hot Toast, Vitest, React Testing Library, ESLint flat config.
  - **Server**: Express 4.21, Mongoose 8.10, Zod 3.24, Helmet, CORS, Cookie Parser, Express Rate Limit, Morgan, Socket.IO 4.8, Razorpay SDK, Nodemailer, Swagger UI Express, Vitest, Supertest, MongoDB Memory Server replica set, ESLint flat config.
- **Environment Validation**: Built `server/src/config/env.js` with Zod schema validation providing clear startup diagnostics. Created `server/.env.example` and `client/.env.example`.
- **Backend Core**: Configured `db.js` (Mongoose connection & disconnection), `app.js` (Express app with security headers, CORS with credentials, cookie parsing, rate limiting, error envelope formatting, and health check), and `server.js` (HTTP server + Socket.IO server + DB initialization + graceful shutdown).
- **Health Check Endpoint**: Implemented `GET /api/health` conforming to `{ success, data, error }` API envelope.
- **Vite Dev Proxy**: Configured Vite dev server to proxy `/api` and `/socket.io` to `http://localhost:5000`.
- **Test Harness**: Configured Vitest for client and server. Implemented in-memory replica set harness (`MongoMemoryReplSet`) with automatic local binary detection.
- **Root Scripts**: Configured `dev`, `build`, `lint`, `test`, `seed` in root `package.json`.
- **CI Workflow**: Added `.github/workflows/ci.yml` covering install, lint, test, and build.

### Phase 2: Design System & Authentication (Completed)
- **Data Models**:
  - `Organization`: name, unique uppercase `registrationCode`, timezone default `Asia/Kolkata`, settings (`autoApproveEmployees`, `requireEmployeeId`, `fuelPricePerLitre`, `operationalCostPerKm`, `cancellationCutoffMinutes`, `requireVehicleVerification`), `isSeeded`.
  - `User`: name, unique email, phone, `passwordHash` (hidden via `select: false` and `toJSON`), role (`EMPLOYEE | COMPANY_ADMIN`), organization ref, `employeeId`, status (`PENDING_APPROVAL | ACTIVE | SUSPENDED | DEACTIVATED`), `licenceNumber`, `passwordResetTokenHash` & expiry, `isSeeded`.
  - `RefreshSession`: user ref, SHA-256 `tokenHash`, `familyId`, `expiresAt`, `revokedAt`, `replacedBy`.
- **Security & Token Lifecycle**:
  - Short-lived Access Token (15 min, `jwtid` uniqueness), kept **in memory only** by the client.
  - Rotating Refresh Token (7 days) in `HttpOnly` cookie scoped to `/api/auth` (`SameSite=Lax`, `Secure` in production).
  - Refresh token reuse detection automatically revokes all sessions belonging to the compromised family.
  - CSRF protection on refresh and logout via Origin validation and `X-Requested-With` header verification.
  - Password reset tokens stored exclusively as SHA-256 hashes with 1-hour expiry, single-use invalidation, and session revocation.
- **Middleware & Endpoints**:
  - `authenticate`, `authorize(roles)`, `organizationScope`, `validate(schema)`, `csrfProtection`.
  - `authLimiter` and `passwordResetLimiter` rate limiting.
  - `POST /api/auth/register` (organization registration code required; status based on `autoApproveEmployees`).
  - `POST /api/auth/login` (rejects non-ACTIVE users with clear status messages; does not leak email existence).
  - `POST /api/auth/refresh` (single-flight rotation + reuse detection).
  - `POST /api/auth/logout` (invalidates session and clears cookie).
  - `POST /api/auth/forgot-password` (sends email via Nodemailer or logs to server console in dev).
  - `POST /api/auth/reset-password` (single-use validation with family revocation).
  - `GET /api/auth/me`, `GET /api/users/me`, `PATCH /api/users/me`, `GET /api/organizations/me`, `GET /api/admin/settings`.
- **Development Seeder**:
  - `server/src/seed/seed.js` (`npm run seed`): Refuses in production; creates demo organization (`ACME2026`), 1 Company Admin, and 3 Active Employees; supports `SEED_AUTO_APPROVE=true`.
- **Design System & UI Components**:
  - Light backgrounds, navy typography, green/teal accents.
  - Reusable: `Button`, `Input` (with password eye toggle), `Card`, `Modal` & `ConfirmDialog`, `Skeleton`, `Badge`, `EmptyState`, `react-hot-toast`.
- **Pages & Layouts**:
  - `PublicLayout`, `EmployeeLayout` (sidebar/topbar, profile dropdown with functional Logout), `AdminLayout`.
  - `SplashScreen` (animated brand splash during session restore).
  - `LandingPage` (hero, prominent Find & Offer actions, how-it-works, illustrative stats, footer).
  - `LoginPage`, `RegisterPage` (React Hook Form + Zod), `ForgotPasswordPage`, `ResetPasswordPage`, `NotFoundPage`.
  - `DashboardPage` (with the TWO prominent, equally clear action cards: Find a Ride and Offer a Ride).
  - `ProfilePage` (profile view & edit).
  - `AdminDashboardPage` (metrics shell and administrative shortcuts).
  - `PlaceholderPage` for unbuilt routes with "Coming in a later phase" badges.
  - `ProtectedRoute` enforcing authentication and role redirection.
- **Verification**:
  - All 20 backend integration tests passing (100%).
  - All 5 frontend tests passing (100%).
  - Linter: 0 errors, 0 warnings across all workspaces.
  - Production client build succeeds in <2 seconds.

### Phase 3: Data Models, Vehicles, Maps, Offer a Ride (Completed)
- **Data Models & GeoJSON Indexes**:
  - Completed all Mongoose models with validation, timestamps, references, and indexes:
    - `Vehicle`: Indian registration validation (`REGISTRATION_REGEX`), model, seating capacity, fuel type, fuel efficiency (supports EV 0 km/l), verification status, organization-scoped unique index.
    - `Ride`: GeoJSON `Point` for origin/destination with `2dsphere` indexes, simplified `LineString` route geometry (<= 300 points), distance/duration, paise fare, recurrence group ID.
    - `Trip`: Execution record linked 1-to-1 with Ride, tracking status lifecycle (`SCHEDULED`, `STARTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
    - `TrackingPoint`: Location breadcrumbs with TTL index for 7-day privacy auto-deletion.
    - `Booking`: Instant seat reservations with partial unique index on `(ride, passenger)` where status is `CONFIRMED`.
    - `Payment`, `Wallet`, `WalletTransaction`, `SavedPlace`, `Message`, `Notification`.
- **Geographic Utilities & Proxies**:
  - `geo.js`: Haversine formula, Ramer-Douglas-Peucker (RDP) polyline simplification to <= 300 points, coordinate boundary format conversions.
  - `geocoding.service.js`: Nominatim proxy with caching, countrycode filtering, 1 req/sec rate throttling, and User-Agent header compliance.
  - `routing.service.js`: OSRM routing proxy with polyline simplification and 24h caching.
  - Endpoints: `GET /api/geo/search`, `GET /api/geo/reverse`, `POST /api/geo/route`.
- **Vehicle Management**:
  - Full CRUD (`/api/vehicles`) with Indian registration number normalization and validation.
  - Admin verification requirement enforcement based on organization settings (`requireVehicleVerification`).
  - Active ride/trip protection preventing deletion of vehicles currently in use.
- **Saved Places**:
  - Full CRUD (`/api/saved-places`) for HOME, OFFICE, and CUSTOM locations with GeoJSON boundary conversion.
- **Offer a Ride Workflow**:
  - `POST /api/rides`: Publishes ride and automatically creates corresponding `SCHEDULED` Trip.
  - Seat capacity validation strictly enforces `totalPassengerSeats <= vehicle.seatingCapacity - 1`.
  - Recurring schedule engine: Generates dated Ride and Trip records with shared UUID `recurrenceGroupId` for up to 4 weeks (max 20 instances).
  - `GET /api/rides/my-offered`: Returns driver's offered rides with populated vehicle and trip statuses.
  - `POST /api/rides/:id/cancel`: Driver cancellation restricted to `SCHEDULED` status; marks Ride and Trip as `CANCELLED` and cascades cancellation to active passenger bookings.
- **Frontend Maps & Offer UI**:
  - Leaflet 1.9 + React-Leaflet integration with custom SVG pin markers and fixed Vite bundling assets.
  - `MapPicker`: Interactive map with debounced address autocomplete, GPS geolocation, saved place quick chips, and draggable pin.
  - `RouteMap`: Polyline route rendering, auto-bounding, and floating distance/duration badge.
  - `VehiclesPage` (`/vehicles`): Responsive vehicle list, verification badges, and registration modal.
  - `SavedPlacesPage` (`/saved-places`): Commute shortcut manager with interactive map pin placement.
  - `OfferRidePage` (`/offer-ride`): Single-page wizard with vehicle selector, passenger seat clamp, live route preview, recurring weekday toggles, and fair fare suggestions.
  - `RouteConfirmationPage` (`/offer-ride/confirm-route`): Route review with Map preview, itinerary summary, and draft state via `RideDraftContext`.
- **Verification**:
  - 32 backend tests passing across health, auth, and phase 3 suites (100%).
  - 5 frontend tests passing (100%).
  - Linter: 0 errors, 0 warnings across all workspaces.
  - Production client build succeeds in 7.22s.

### Phase 4: Find a Ride, Matching, Booking, Cancellation, My Trips & Transitions (Completed)
- **Ride Matching Engine (`matching.service.js` & `GET /api/rides/search`)**:
  - Multi-tenant query scoped to passenger organization.
  - Pre-filtering using `2dsphere` spatial radius query around origin coordinates.
  - Strict matching rules:
    - Status must be `OPEN` and associated Trip must be `SCHEDULED`.
    - Departure is strictly in the future and within user window (configurable default ±30 min).
    - Available seats >= requested seats.
    - Passenger is not the driver and has no conflicting `CONFIRMED` booking or offered ride at that time.
    - Proximity validation: passenger pickup is within 2 km of stored route polyline, drop is within 2 km of stored route polyline, and pickup precedes drop along route direction index.
  - Explainable composite ranking score based on pickup proximity, route deviation, time delta, and fare.
- **Atomic Booking Reservation (`booking.service.js`, `booking.controller.js`)**:
  - `POST /api/bookings`: Atomic reservation using atomic update `Ride.findOneAndUpdate({ _id, organization, status: 'OPEN', availableSeats: { $gte: seats }, departureAt: { $gt: now } }, { $inc: { availableSeats: -seats } })`.
  - Compensating rollback ($inc seats back) if Booking model creation fails.
  - Partial unique MongoDB index on `(ride, passenger)` where `status: 'CONFIRMED'` preventing duplicate simultaneous bookings.
  - Recurring booking support (`POST /api/bookings/recurring`): books individual ride instances independently with per-instance success/failure reporting.
  - In-app notification created for the driver upon booking confirmation.
- **Cancellation Flow**:
  - `POST /api/bookings/:id/cancel`: Passenger cancellation with organization cancellation cutoff enforcement (e.g. 60 minutes before departure). Atomically increments available seats on Ride.
  - `POST /api/rides/:id/cancel`: Driver cancellation for `SCHEDULED` rides. Sets Ride and Trip status to `CANCELLED`, cascades cancellation to all active passenger bookings, and notifies affected passengers.
- **My Trips (`GET /api/trips/my-trips`)**:
  - Query filtering supporting: `all`, `upcoming`, `offered`, `booked`, `active`, `completed`, `cancelled`.
  - Aggregates populated driver, vehicle, ride, passenger count, and user-specific passenger lifecycle status (`REQUESTED`, `BOOKED`, `PICKED_UP`, `COMPLETED`, `CANCELLED`).
- **Trip Lifecycle Transitions (`PATCH /api/trips/:id/status`, `lifecycle.service.js`)**:
  - Strict state machine: `SCHEDULED -> STARTED -> IN_PROGRESS -> COMPLETED` (or `CANCELLED`).
  - Driver authorization verification.
  - Validation: cannot start cancelled trips, cannot complete twice, cannot start without confirmed bookings (configurable org policy `allowStartWithoutPassengers`).
  - On `COMPLETED`: transitions all confirmed bookings to `COMPLETED`, updates payment status to `UNPAID` (ready to pay), and triggers passenger notifications.
- **Frontend Find & Booking UI**:
  - `FindRidePage` (`/find-ride`): Commute search form with Leaflet map, address autocomplete, time window selection, seat picker, and weekday recurrence toggles.
  - `RouteConfirmationPage` (`/find-ride/confirm-route`): Route verification preview with distance and duration before executing search.
  - `AvailableRidesPage` (`/rides`): Displays matching rides list with driver details, verified badges, rating display, seat counters, price per seat, and route previews.
  - `RideDetailsPage` (`/rides/:id`): Detailed ride itinerary, co-passenger count, vehicle specs, and seat booking modal.
  - `BookingConfirmationPage` (`/booking-confirmation/:bookingId`): Server-confirmed reservation summary with direct link to My Trips.
  - `MyTripsPage` (`/my-trips`): Tabbed management interface (Upcoming, Booked by me, Offered by me, Active, Completed, Cancelled) with action triggers (View Details, Cancel, Start Trip, Complete Trip).
  - `TripDetailsPage` (`/trips/:id`): Deep trip management view with passenger manifest, vehicle verification status, lifecycle steppers, and cancellation modals.
- **Verification**:
  - 46 backend integration tests passing (100% across health, auth, phase 3, and phase 4 suites).
  - Client production build succeeds in <6s with 0 errors.
  - Monorepo lint passes.

### Phase 5: Real-time: Socket.IO, Live Tracking, Chat, Notifications (Completed)
- **Socket.IO Server & Authentication (`sockets/index.js`, `sockets/emitter.js`)**:
  - Attached to HTTP server with CORS strictly configured to `CLIENT_URL`.
  - JWT connection authentication (`io.use`) reading token from `handshake.auth.token`. Rejects missing, invalid, or non-`ACTIVE` users.
  - Automatic private user room assignment: `user:<userId>`.
  - Graceful token expiration handling with error codes enabling transparent client reconnection.
- **Live GPS Tracking Engine (`sockets/tracking.socket.js`, `services/tracking.service.js`)**:
  - Participant room authorization (`trip:join`): allows only driver or confirmed passengers within the same organization. Sends initial snapshot with last known location, timestamp, and ETA.
  - Driver location broadcaster (`driver:location`): validates driver identity, active status (`STARTED` or `IN_PROGRESS`), coordinate validity (-90..90, -180..180).
  - Rate throttling: enforces maximum 1 location update per 3 seconds per trip, silently dropping excess updates.
  - State progression: first accepted driver location atomically advances trip status from `STARTED` to `IN_PROGRESS`, notifies passengers, and broadcasts `trip:status`.
  - Stored coordinates in TTL collection (`TrackingPoint`) and updated on `Trip`.
  - Stale detection: flags location as stale if no update received in 30 seconds.
  - ETA calculation: calculated to destination via routing service, cached for 45 seconds to protect provider quotas; gracefully retains prior ETA marked stale on failure.
  - Trip termination: broadcasts `trip:status` on `COMPLETED` and `CANCELLED`, evicting sockets from the trip room.
  - Participant tracking snapshot: `GET /api/trips/:id/tracking`.
- **In-Trip Real-Time Chat (`sockets/chat.socket.js`, `controllers/chat.controller.js`)**:
  - Driver and confirmed passengers only; company admins strictly barred from chat content.
  - Events: `chat:send` (validated: 1-1000 characters, trimmed, sanitized), `chat:message` (room broadcast), `chat:read` (read receipt sync).
  - Rate-limited to 10 sends per 10 seconds per user.
  - Read-only window: chat remains accessible for messaging until 24 hours after trip completion, then locks into read-only archive mode.
  - REST endpoints: `GET /api/chat/conversations` (with unread counters) and `GET /api/trips/:id/messages` (paginated, chronological).
- **Socket Notifications (`services/notification.service.js`)**:
  - Real-time event push: creating a notification emits `notification:new` to `user:<userId>` room.
  - Covers booking lifecycle, trip lifecycle transitions, and chat messages (when recipient is not in room).
- **Development Tracking Simulator (`controllers/dev.controller.js`, `routes/dev.routes.js`)**:
  - `POST /api/dev/trips/:id/simulate-location`: Driver-only endpoint walking route geometry with `simulated: true`.
  - Strictly disabled when `NODE_ENV === 'production'` or `ENABLE_TRACKING_SIMULATOR !== 'true'`.
- **Frontend Real-time Interface**:
  - `SocketContext` & `useSocket`: Automatic connection management, token refresh handling, reconnection banners, and status badges.
  - `TripTrackingPage` (`/trips/:id/tracking`): Animated driver marker, route polyline, destination ETA, lifecycle stepper, stale location warning (>30s), real `tel:` call link, and embedded chat drawer.
  - Driver tracking controller: high-accuracy GPS watch position (`navigator.geolocation.watchPosition`) with user permission prompts, sharing indicators, and simulator trigger in development.
  - `ChatPage` (`/chat`): Full-featured messaging view with conversation list, unread badges, auto-scroll thread, character counters, and read-only banners.
  - Header notification bell: real-time badge updates and instant push toast alerts.
- **Verification**:
  - 68 backend integration tests passing (100% across health, auth, phase 3, phase 4, and phase 5 suites).
  - 8 client component/route tests passing (100% including chat input validation and stale location warning).
  - 0 ESLint errors and 0 warnings across all workspaces.
  - Client production build succeeds in 6.46s.

### Phase 6: Payments and Wallet (Sandbox Only) (Completed)
- **Rules & Principles**:
  - Never process real money. Every payment/wallet screen shows a visible "Test mode, no real money" banner.
  - All currency is integer paise (minor units). The server determines payment amounts from `booking.fareTotalMinor`; client amounts are strictly ignored.
  - All balance changes use single-document atomic updates (`findOneAndUpdate`) with unique idempotency keys without depending on MongoDB multi-document transactions.
  - Driver earnings: non-cash payments credit the driver's wallet with an `EARNING` ledger entry for full fare (0% commission).
- **Backend Architecture & Services**:
  - Gateway Abstraction: `RazorpayGateway` (Razorpay SDK test mode) and `SimulatedGateway` (when keys absent & `ALLOW_SIMULATED_PAYMENTS=true`). Returns HTTP 503 `PAYMENTS_NOT_CONFIGURED` if keys are missing and simulation is disabled.
  - Verification Security: Timing-safe HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) for both checkout signatures and webhook callbacks.
  - Atomic Ledger & Consistency: `getOrCreateWallet`, `checkLedgerConsistency`, `executeWalletPayment`, `creditDriverEarning`, `rechargeWallet`. Invariant verified: `balanceMinor === sum(ledger entries)`.
  - Concurrency Lock: Pre-locking payment attempts using unique index on `Payment.idempotencyKey` prevents duplicate debits or race conditions during simultaneous requests.
  - Cash Settlement Flow: Passenger requests `PENDING_CASH_CONFIRMATION` (or cancels); driver confirms physical receipt (`PAID`); cash makes zero wallet movement.
  - Razorpay Webhooks: Raw body parser mounted on `/api/payments/webhook` with `RAZORPAY_WEBHOOK_SECRET` validation.
  - Endpoints:
    - Payments: `POST /api/payments/create-order`, `POST /api/payments/verify`, `POST /api/payments/wallet-pay`, `POST /api/payments/cash`, `POST /api/payments/:id/cancel-cash`, `POST /api/payments/:id/cash-confirmation`, `POST /api/payments/webhook`, `GET /api/payments/my`, `GET /api/payments/:id`.
    - Wallet: `GET /api/wallet`, `GET /api/wallet/transactions`, `POST /api/wallet/recharge`, `POST /api/wallet/recharge/verify`, `POST /api/wallet/simulate-recharge`.
    - Preferences: `PATCH /api/users/me/payment-preference`.
- **Frontend Payment & Wallet UI**:
  - `PaymentPage` (`/trips/:id/pay`): Fare breakdown, Test Mode banner, method selector (Wallet, Card, UPI, Cash) preselecting user's saved preference, insufficient wallet balance warning with recharge link, Razorpay checkout.js dynamic loader, and simulated payment modal.
  - `ReceiptPage` (`/payments/:id/receipt`): Printable/PDF receipt card with status badge, amount, method, timestamp, gateway reference, route details, and driver/passenger info.
  - `WalletPage` (`/wallet`): Balance card, driver earnings summary, transaction ledger with type filter tabs (All, Recharges, Payments, Earnings), and recharge modal (presets ₹100/₹200/₹500/₹1000, custom input ₹10–₹10,000, and simulated instant recharge).
  - `SettingsPage` (`/settings`): Preferred payment method configuration.
  - `TripDetailsPage`: Integrated "Pay Fare" button for completed trips, "View Receipt" button for paid trips, and driver "Pending Cash Confirmations" card with instant confirmation actions.
  - `DashboardPage` & `MyTripsPage`: Real-time wallet balance widget and quick Pay links on completed trips.
- **Verification**:
  - 93 backend tests passing (100% across all 6 test suites, including 25 Phase 6 tests).
  - 10 client unit tests passing (100%, including PaymentPage method selection and insufficient wallet balance tests).
  - 0 ESLint errors and 0 warnings across monorepo.
  - Client production build succeeds in <5s.

### Phase 7: Ride History, Settings, Administration & Reports (Completed)
- **Backend Architecture & Services**:
  - `GET /api/history`: Full ride history for drivers and passengers with location search, multi-filters (role, status, paymentStatus), sorting, and pagination. Survives vehicle deletion through immutable `vehicleSnapshot` data on `Ride`.
  - Customer Support: `POST /api/users/support` (rate-limited, ticket number generated, category validation) and `GET /api/users/support/my`.
  - Employee Analytics: `GET /api/users/reports` showing personal travel distance, fuel consumption estimate, and estimated savings compared to solo driving.
  - Admin Role Isolation & Monitoring:
    - `GET /api/admin/summary`: Live KPI count cards for pending approvals, vehicles, rides today, and monthly trips.
    - `GET /api/admin/employees` & `PATCH /api/admin/employees/:id/status`: Employee approval, suspension, deactivation, and reactivation with session invalidation, socket disconnection, and cascaded future ride/booking cancellations.
    - `GET /api/admin/vehicles` & `POST /api/admin/vehicles/:id/verify`: Admin inspection, verification, and rejection with rejection reason.
    - `GET /api/admin/rides`: Read-only operational overview with privacy protection (company admins strictly prohibited from reading private participant chat).
    - `GET|PATCH /api/admin/settings` & `POST /api/admin/settings/regenerate-code`: Dynamic organization settings (fuel pricing, operational cost, cancellation cutoff, registration code regeneration).
    - `GET /api/admin/reports`: Organization travel analytics, fuel consumption calculation, vehicle-wise cost analysis, and CSV export streaming (`format=csv`).
- **Frontend Management & Reports Interface**:
  - `RideHistoryPage` (`/history`): Search, filters, sort, pagination, desktop table, and mobile card views.
  - `EmployeeReportsPage` (`/reports`): Personal travel distance, cost savings, and fuel stats with date-range filters.
  - `HelpSupportPage` (`/help`): FAQ accordion, support ticket submission form, and user ticket tracking.
  - `SettingsPage` (`/settings`): Profile editing, notification toggles, default payment selector, password change, and section navigation shortcuts.
  - `AdminDashboardPage` (`/admin`): Live summary tiles linking directly to administrative workflows.
  - `AdminEmployeesPage` (`/admin/employees`): Employee administration with search, status filters, and confirmation modals.
  - `AdminVehiclesPage` (`/admin/vehicles`): Vehicle verification queue with specs, registration formatting, and rejection reasons.
  - `AdminRidesPage` (`/admin/rides`): Read-only organization ride monitoring with itinerary inspection dialog.
  - `AdminReportsPage` (`/admin/reports`): Interactive Recharts charts (monthly trips and fuel/pkm trend), summary KPI tiles, vehicle-wise cost table, and CSV download.
  - `AdminSettingsPage` (`/admin/settings`): Organization configuration form with access code regeneration modal.
  - `AppRoutes.jsx`: Connected all employee and admin Phase 7 routes replacing all placeholders.
- **Verification**:
  - 113 backend integration tests passing (100% across all 7 test suites, including 20 Phase 7 tests).
  - 11 client unit tests passing (100%, including RideHistoryPage responsive tests).
  - Production client build succeeds in 14.8s with 0 errors.

### Phase 9: UI Polish and Micro-Interactions (Completed)
- **Motion Design System & Tokens (`client/src/index.css`)**:
  - Centralized CSS variables: durations (`--duration-fast: 150ms`, `--duration-base: 250ms`, `--duration-slow: 400ms`), custom easing curves (`--ease-out`, `--ease-in-out`, `--ease-spring`), elevation shadows (`--shadow-rest`, `--shadow-hover`, `--shadow-active`), and standardized border-radii.
  - Reusable keyframes & utility classes: `fadeIn` (`.animate-fade-in`), `slideUp` (`.animate-slide-up`), `slideDown` (`.animate-slide-down`), `scaleIn` (`.animate-scale-in`), `shimmer` (`.animate-shimmer`), `pulseSoft` (`.animate-pulse-soft`), `pulseRing` (`.animate-pulse-ring`), `shake` (`.animate-shake`), `badgePop` (`.animate-badge-pop`), `bellRing` (`.animate-bell-ring`), `floatGentle` (`.animate-float`), and staggered delay helpers (`.stagger-1` to `.stagger-5`).
  - Strict accessibility: Global `@media (prefers-reduced-motion: reduce)` resets all transitions and animations to 0.01ms. Text selection matching the teal brand and subtle modern webkit scrollbars.
- **Shared Motion & Transition Components (`client/src/components/common/`)**:
  - `ScrollToTop.jsx`: Automatically and silently resets window scroll on route changes (`pathname`) with jsdom fallback.
  - `TopProgressBar.jsx`: Ultra-lightweight top-pinned accent progress bar for instant route transition feedback.
  - `RevealOnScroll.jsx`: IntersectionObserver component providing scroll reveal with staggered card entrance.
  - `AnimatedNumber.jsx`: High-performance requestAnimationFrame count-up helper with cubic easing, reduced-motion fallback, and guaranteed exact formatted final value.
  - `Avatar.jsx`: Deterministic initials badge palette with image error fallback and smooth fade-in.
- **Component & Layout Polish**:
  - `Button.jsx`: Smooth hover lift (`hover:-translate-y-0.5`), active press (`active:scale-[0.97]`), focus ring, and stable loading state preserving button dimensions without layout shifts.
  - `Input.jsx`: Animated focus border and ring, smooth collapsible error message reveal, and submit-with-error shake.
  - `Card.jsx`: Hover lift with soft shadow growth, active scale, and selected teal boundary ring. Dashboard CTA cards with accent gradient glows and arrow translate nudges.
  - `Modal.jsx`: Smooth backdrop fade and modal window scale-in entrance.
  - `Skeleton.jsx`: Updated from basic opacity pulsing to high-fidelity gradient sweep shimmer (`.animate-shimmer`), plus `SkeletonTableRows` for tabular interfaces.
  - `EmptyState.jsx`: Floating illustrative badge entrance.
  - `EmployeeLayout.jsx` & `AdminLayout.jsx`: Scroll-reactive sticky header shadow (`isScrolled`), profile dropdown scale-and-fade in, notification bell badge-pop and hover bell-ring, and route transition fade wrappers.
  - `TripTrackingPage.jsx` & Leaflet Maps: Smooth Leaflet vehicle marker translation via CSS transform cubic-bezier curve, live marker pulse ring, live indicator soft pulses, and trip stepper pop.
  - Data Visualizations: Recharts enabled with `isAnimationActive={true}`, `animationDuration={800}`, `animationEasing="ease-out"`, styled dark tooltips, and numeric count-ups via `AnimatedNumber`.
- **Verification & Performance**:
  - 113 backend tests passing (100% across all 7 test suites).
  - 11 frontend tests passing (100% across all 7 test suites).
  - ESLint: 0 errors, 0 warnings across all workspaces.
  - Production bundle impact: CSS +10.25 kB (+1.68 kB gzip), JS +11.19 kB (+3.26 kB gzip) — under 5 kB gzipped addition with zero heavy third-party animation libraries.
  - Browser walkthrough verified on desktop (1280px) and mobile (375px) with zero layout shifts.

---

## 3. Key Architectural Decisions
1. **Response Envelope**: Standardized envelope for all API endpoints:
   ```json
   {
     "success": true,
     "data": { ... },
     "error": null
   }
   ```
2. **In-Memory Access Tokens**: The frontend keeps JWT access tokens strictly in memory state (`AuthContext` / Axios module variable). They are never saved to `localStorage` or `sessionStorage`.
3. **Session Persistence**: App startup initiates a silent refresh call (`POST /api/auth/refresh`) using the `HttpOnly` cookie while showing the `SplashScreen`.
4. **Single-Flight Refresh Lock**: If parallel requests encounter a 401, a single refresh request is dispatched while concurrent requests queue and await the new token.
5. **No Tenant Leakage**: Registration requires typing the organization's registration code; no public tenant list is ever displayed.
6. **No Email Enumeration**: Login and forgot-password endpoints never reveal whether an email exists in the system.

---

## 4. Repository Folder Map
```
carpooling-platform/
├── .github/
│   └── workflows/
│       └── ci.yml               # Continuous Integration (install, lint, test, build)
├── client/
│   ├── src/
│   │   ├── api/                 # axios.js (refresh interceptor), auth.api.js
│   │   ├── components/
│   │   │   └── common/          # Button, Input, Card, Modal, Skeleton, Badge, EmptyState
│   │   ├── context/             # AuthContext.jsx
│   │   ├── layouts/             # PublicLayout, EmployeeLayout, AdminLayout
│   │   ├── pages/
│   │   │   ├── public/          # SplashScreen, LandingPage, LoginPage, RegisterPage,
│   │   │   │                    # ForgotPasswordPage, ResetPasswordPage, NotFoundPage
│   │   │   ├── employee/        # DashboardPage, ProfilePage
│   │   │   ├── admin/           # AdminDashboardPage
│   │   │   └── PlaceholderPage.jsx # "Coming in a later phase" for future routes
│   │   ├── routes/              # AppRoutes.jsx, ProtectedRoute.jsx
│   │   ├── App.jsx              # Router, AuthProvider, Toaster wrapper
│   │   ├── App.test.jsx
│   │   ├── index.css            # Tailwind CSS v4 entry
│   │   └── main.jsx
│   ├── .env.example
│   ├── eslint.config.js
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── Carpooling_Platform.pdf  # Problem statement & original requirements
│   └── MASTER_PROMPT.md         # Full project specification
├── server/
│   ├── src/
│   │   ├── config/              # db.js, env.js (Zod startup validation)
│   │   ├── controllers/         # auth.controller.js, user.controller.js, organization.controller.js
│   │   ├── middleware/          # authenticate, authorize, organizationScope, validate,
│   │   │                        # rateLimiters, csrfProtection
│   │   ├── models/              # Organization, User, RefreshSession
│   │   ├── routes/              # auth.routes.js, user.routes.js, organization.routes.js, admin.routes.js
│   │   ├── seed/                # seed.js (development seeder)
│   │   ├── services/            # mail.service.js
│   │   ├── utils/               # token.js (JWT & SHA-256 crypto helpers)
│   │   ├── validators/          # auth.validator.js (Zod request schemas)
│   │   ├── app.js               # Express application
│   │   └── server.js            # HTTP & Socket.IO server
│   ├── tests/
│   │   ├── setup.js             # MongoMemoryReplSet harness
│   │   ├── health.test.js       # Health endpoint test
│   │   └── auth.test.js         # 18 authentication & authorization integration tests
│   ├── .env.example
│   ├── Dockerfile
│   ├── eslint.config.js
│   └── package.json
├── docker-compose.yml
├── .gitignore
├── package.json                 # Monorepo workspaces
├── PROJECT_STATE.md             # Persistent memory across development phases
└── README.md                    # Project documentation & instructions
```

---

## 5. Exact Commands

| Action | Command |
|---|---|
| **Install Dependencies** | `npm install` |
| **Run Dev Servers (Client + Server)** | `npm run dev` |
| **Run Linter** | `npm run lint` |
| **Run Tests (All Workspaces)** | `npm run test` |
| **Build Production Client** | `npm run build` |
| **Seed Database (Development)** | `npm run seed` |
| **Seed with Auto-Approval** | `set SEED_AUTO_APPROVE=true&& npm run seed` |

---

## 6. Seed Credentials (Development)

Run `npm run seed` to populate demo records:
- **Organization**: `Acme Global Technologies`
- **Registration Code**: `ACME2026`
- **Company Admin**:
  - Email: `admin@enterprise.local`
  - Password: `Admin@Pass123`
- **Sample Employees** (Password for all: `Employee@Pass123`):
  1. `priya.sharma@enterprise.local` (EMP-101, Driver/Passenger)
  2. `rahul.verma@enterprise.local` (EMP-102, Driver/Passenger)
  3. `sneha.patel@enterprise.local` (EMP-103, Passenger)

---

## 7. Password Reset in Development
When SMTP environment variables (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`) are omitted, requesting a password reset via `POST /api/auth/forgot-password` prints the full one-time reset link directly into the server terminal console:
```
==================================================
📧 [PASSWORD RESET EMAIL] (SMTP not configured)
Recipient : user@enterprise.local
Reset URL : http://localhost:5173/reset-password?token=...
Expires   : in 1 hour
==================================================
```
Clicking or pasting that link navigates to `ResetPasswordPage.jsx` where the new password can be configured.

---

## 8. Next Step
- **Phase 7 — Admin Dashboard, Management, Reports & Polish**:
  - Company Admin dashboard: employee verification, vehicle approval, ride monitoring, organization policies.
  - Analytics & Reports: carbon offset tracking, cost savings, fuel efficiency metrics, commute statistics.
  - Ride history with advanced filtering and search.
  - Final end-to-end polish and production deployment readiness.
