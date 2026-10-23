# Project State — Enterprise Carpooling Platform

## 1. Project Overview
- **Project**: Enterprise Carpooling Platform (MERN)
- **Architecture**: Multi-tenant enterprise carpooling web application (React 18 + Express 4 + MongoDB + Socket.IO)
- **Status**: Phase 1 (Foundation) Completed

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
- **Test Harness**: Configured Vitest for client and server. Implemented in-memory replica set harness (`MongoMemoryReplSet`) with automatic local binary detection. Added Supertest health check test for backend and Vitest unit test for frontend.
- **Root Scripts**: Configured `dev`, `build`, `lint`, `test`, `seed` in root `package.json`.
- **CI Workflow**: Added `.github/workflows/ci.yml` covering install, lint, test, and build.

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
2. **ES Modules**: Standardized on native ES modules (`"type": "module"`) across both client and server.
3. **Database Transactions**: Mongoose connection configured with optional replica-set support in tests. Code logic is designed to use atomic updates (`findOneAndUpdate`) with compensating rollbacks to remain safe without mandatory transactions.
4. **Environment Safety**: Secrets must never be committed; startup validates mandatory keys with actionable error logs.

---

## 4. Repository Folder Map
```
carpooling-platform/
├── .github/
│   └── workflows/
│       └── ci.yml               # Continuous Integration (install, lint, test, build)
├── client/
│   ├── src/
│   │   ├── api/                 # API client services (axios)
│   │   ├── components/          # Common, layout, forms, maps, rides, trips, charts
│   │   ├── context/             # Auth, notifications, ride drafts
│   │   ├── hooks/               # Custom React hooks
│   │   ├── layouts/             # PublicLayout, EmployeeLayout, AdminLayout
│   │   ├── pages/               # public/, employee/, admin/, NotFoundPage.jsx
│   │   ├── routes/              # AppRoutes.jsx, ProtectedRoute.jsx
│   │   ├── utils/               # Formatting, constants
│   │   ├── App.jsx              # App root component
│   │   ├── App.test.jsx         # App component tests
│   │   ├── index.css            # Tailwind CSS v4 entry
│   │   ├── main.jsx             # React DOM entry
│   │   └── setupTests.js        # Vitest jest-dom setup
│   ├── .env.example
│   ├── eslint.config.js         # ESLint flat config
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js           # Vite config with proxy & tailwind plugin
│   └── vitest.config.js         # Client test configuration
├── docs/
│   ├── Carpooling_Platform.pdf  # Original hackathon problem statement
│   └── MASTER_PROMPT.md         # Full project specification & master prompt
├── server/
│   ├── src/
│   │   ├── config/              # db.js (Mongoose), env.js (Zod env validation)
│   │   ├── controllers/         # Module controllers
│   │   ├── middleware/          # Auth, validation, rate limiting, error handling
│   │   ├── models/              # Mongoose schemas & models
│   │   ├── routes/              # Express API routers
│   │   ├── seed/                # Seed script
│   │   ├── services/            # Matching, geocoding, routing, payment, wallet, tracking
│   │   ├── sockets/             # Socket.IO handlers
│   │   ├── utils/               # Geo calculations, money helpers, asyncHandler
│   │   ├── app.js               # Express application configuration
│   │   └── server.js            # HTTP and Socket.IO entry point
│   ├── tests/
│   │   ├── setup.js             # MongoMemoryReplSet harness
│   │   └── health.test.js       # Health check tests
│   ├── .env.example
│   ├── eslint.config.js         # ESLint flat config
│   ├── package.json
│   └── vitest.config.js         # Server test configuration
├── .gitignore
├── package.json                 # Root monorepo workspace scripts
├── PROJECT_STATE.md             # Persistent memory across development phases
└── README.md                    # Project documentation
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
| **Database Seed** | `npm run seed` |

---

## 6. Environment Variables Required

### Server (`server/.env` based on `server/.env.example`)
| Variable | Description | Default / Example |
|---|---|---|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Backend listening port | `5000` |
| `CLIENT_URL` | Frontend origin for CORS | `http://localhost:5173` |
| `MONGODB_URI` | MongoDB connection URI | `mongodb://127.0.0.1:27017/carpooling` |
| `JWT_ACCESS_SECRET` | Secret for short-lived access JWT (min 16 chars) | Must be filled in |
| `JWT_REFRESH_SECRET` | Secret for refresh token (min 16 chars) | Must be filled in |
| `COOKIE_SAME_SITE` | Cookie SameSite setting (`lax`, `strict`, `none`) | `lax` |
| `COOKIE_SECURE` | Set cookie Secure flag | `false` in dev |
| `GEOCODING_URL` | Nominatim / geocoding API URL | `https://nominatim.openstreetmap.org` |
| `MAP_ROUTING_URL` | OSRM / routing API URL | `https://router.project-osrm.org` |
| `GEO_USER_AGENT` | Nominatim compliant user-agent string | `CarpoolingPlatform/1.0 (contact@carpooling.local)` |
| `RAZORPAY_KEY_ID` | Razorpay Test Key ID | `rzp_test_...` (optional for Phase 1) |
| `RAZORPAY_KEY_SECRET` | Razorpay Test Key Secret | Optional for Phase 1 |
| `ALLOW_SIMULATED_PAYMENTS`| Allow fallback simulated payments | `true` |
| `SEED_ADMIN_EMAIL` | Default seed administrator email | `admin@enterprise.local` |
| `SEED_ADMIN_PASSWORD` | Default seed administrator password | `Admin@Pass123` |

### Client (`client/.env` based on `client/.env.example`)
| Variable | Description | Default / Example |
|---|---|---|
| `VITE_API_URL` | Optional API base URL override | Leave empty in dev (uses Vite proxy) |
| `VITE_MAP_TILE_URL` | Tile map provider URL | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `VITE_MAP_ATTRIBUTION`| Map attribution string | `&copy; OpenStreetMap contributors` |
| `VITE_RAZORPAY_KEY_ID`| Razorpay public test key ID | `rzp_test_...` (optional for Phase 1) |

---

## 7. Known Issues / Limitations
- None in Phase 1. All baseline unit tests, linting, and build pass cleanly.

---

## 8. Next Step
- **Phase 2 — Design System and Authentication**:
  - Implement full design system tokens, typography, and reusable components.
  - Implement Splash screen, Landing page, Register, Login, Refresh/Logout, Forgot/Reset password.
  - Setup AuthContext with axios refresh token interceptor (single-flight lock).
  - Setup protected routes with role-based routing (EmployeeLayout, AdminLayout).
  - Implement Organization model with unique registration code.
  - Implement dev admin seed.
  - Auth and authorization tests.
