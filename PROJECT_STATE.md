# Project State — Enterprise Carpooling Platform

## 1. Project Overview
- **Project**: Enterprise Carpooling Platform (MERN)
- **Architecture**: Multi-tenant enterprise carpooling web application (React 18 + Express 4 + MongoDB + Socket.IO)
- **Status**: Phase 2 (Design System & Authentication) Completed

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
- **Phase 3 — Data Models, Vehicles, Maps, Offer a Ride**:
  - Implement remaining Mongoose models: `Vehicle`, `Ride`, `Trip`, `TrackingPoint`, `SavedPlace`.
  - Indian vehicle registration validation (`KA01AB1234` / BH-series) and vehicle CRUD.
  - Geo proxy services (`/api/geo/search`, `/api/geo/reverse`, `/api/geo/route` via Nominatim & OSRM with debouncing and caching).
  - Leaflet `MapPicker` and `RouteMap` components with OpenStreetMap tiles.
  - Route confirmation screen (`mode = offer`).
  - Publish Ride (generates dated Ride + scheduled Trip records, recurrence groups).
  - My Offered Rides page.
