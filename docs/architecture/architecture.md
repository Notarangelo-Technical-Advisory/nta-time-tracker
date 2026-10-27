# NTA Time Tracker — Tech Stack & Architecture

> **Last checked against the code**: 2026-10-27
> **Status**: Authoritative reference. Keep it in step with the code. See [Keeping This Doc Updated](#keeping-this-doc-updated).

NTA Time Tracker records Jack Notarangelo's time for each customer and project, turns unbilled time into invoices, and writes AI status reports. Customers sign in to a read-only portal to see their own projects, time and invoices. The package and build names still say `fta-time-tracker`; the app shows "Notarangelo Technical Advisory".

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Angular, standalone components, `application` builder | 22.2.1 |
| Language | TypeScript (app) / TypeScript (functions) | 6.0.3 / ~5.8.3 |
| Change detection | `zone.js` with `provideZoneChangeDetection()`; components use `Eager` | zone.js 0.15.1 |
| Firebase (browser) | Firebase JS SDK with `rxfire`; no AngularFire | 11.10.0 / 6.2.0 |
| Firebase (functions) | `firebase-admin` / `firebase-functions` (2nd generation) | 13.7.0 / 6.6.0 |
| PDF export | `jspdf` + `jspdf-autotable` | 2.5.2 / 3.8.4 |
| Word export | `docx` | 9.6.1 |
| AI | Claude API through plain `fetch` from a Cloud Function | `claude-sonnet-5-5` |
| Tests | Karma + Jasmine on the Firebase Auth and Firestore emulators | karma 6.4.4, jasmine 5.1.2 |
| Commit checks | commitlint (shared type list) + Husky `commit-msg` hook | commitlint 20, husky 9 |
| Runtime | Node.js 22 for builds, CI and Cloud Functions (`engines.node`) | 22 |
| Hosting | Firebase Hosting | — |

---

## Project Structure

```
nta-time-tracker/
├── src/
│   ├── app/
│   │   ├── components/     # Pages, one folder per area (see below)
│   │   ├── guards/         # authGuard, noAuthGuard, adminGuard, customerGuard
│   │   ├── models/         # TypeScript interfaces for each collection
│   │   ├── services/       # All Firestore and Functions access
│   │   ├── firebase.ts     # Injection tokens for the Firebase SDK objects
│   │   ├── app.routes.ts   # Routes
│   │   └── app.config.ts   # Providers
│   ├── environments/       # Firebase web config; version.ts is written by CI
│   ├── styles/             # _tokens.scss, _mixins.scss, _components.scss
│   ├── testing/            # emulator-testing.ts (test helpers)
│   └── assets/             # nta-logo.jpg (pages and exports), favicons
├── functions/src/index.ts  # Cloud Function generateStatusReport
├── scripts/                # migrate-outcomes.mjs (one-time, already run)
├── docs/
│   ├── architecture/       # This document
│   └── standards/          # Copy of the shared engineering standards; do not edit here
├── firestore.rules         # Security rules
├── firestore.indexes.json  # Composite indexes
└── .github/workflows/      # deploy-and-release.yml
```

`src/app/components/`:

| Folder | Pages |
|---|---|
| `auth/` | Sign-in and password reset; sign-up from an invite link |
| `dashboard/` | Admin dashboard with key figures |
| `time-entry/` | Time entry list and form |
| `customers/` | Customer list (with an unbilled-time invoice preview) and form |
| `projects/` | Project list and form |
| `invoices/` | Invoice list, invoice wizard, invoice detail with status actions and PDF |
| `status-reports/` | Report list, report wizard, report detail with inline edits, PDF and DOCX |
| `reports/` | Weekly hours chart (SVG) with a landscape PDF export |
| `users/` | User management and invites |
| `portal/` | Customer portal dashboard and read-only invoice view |

---

## Architecture

### Routing

All routes load their component lazily, and the router preloads them all (`PreloadAllModules`).

| Area | Routes | Guards |
|---|---|---|
| Public | `/auth`, `/invite/:token` | `noAuthGuard` (a signed-in user goes to `/dashboard`) |
| Admin | `/dashboard`, `/time-entries`, `/customers`, `/projects`, `/invoices`, `/status-reports`, `/users`, `/reports/hours`, with their `new`, `:id/edit`, `generate` and `:id` pages | `authGuard`, `adminGuard` |
| Customer | `/portal`, `/portal/invoices/:id` | `authGuard`, `customerGuard` |

`adminGuard` and `customerGuard` read `userProfiles/{uid}.role`. A user with the wrong role goes to the other area. A user with no profile is signed out and sent to `/auth`. `''` and any unknown path redirect to `/auth`.

### Firebase access

- `src/app/firebase.ts` defines the tokens `FIREBASE_APP`, `AUTH`, `FIRESTORE` and `FUNCTIONS`. `provideFirebase()` creates each object the first time it is injected.
- Services inject these tokens. They never call `getAuth()` or `getFirestore()` directly, so tests can provide emulator-connected objects instead.
- `environment.useEmulators` connects the app to the emulators (Auth 9099, Firestore 8080, Functions 5001). Both environment files set it to `false`.

### Key Services

| Service | Responsibility | Collections |
|---|---|---|
| `AuthService` | Sign in and out, password reset, `lastLogin`, role and `customerId` helpers. Signs out an account with no profile. Sends admins to `/dashboard` and customers to `/portal`. | `userProfiles` |
| `CustomerService` | Customer CRUD and active customers. Numbers customers `CUST-NNN`. | `customers` |
| `ProjectService` | Project CRUD, by customer and active. Numbers projects `PROJ-NNN`. | `projects` |
| `TimeEntryService` | Time entry CRUD, unbilled entries per customer, batch status changes (billed, paid, released), duration in hours to 2 decimals. | `timeEntries` |
| `InvoiceService` | Creates invoices (one line per entry), status changes, reopening a cancelled invoice, rebilling checks. Numbers invoices `INV-YYYY-NNN`. | `invoices`, `timeEntries` |
| `StatusReportService` | Calls `generateStatusReport`, saves and edits reports, reads and updates the outcomes record. Numbers reports `RPT-YYYY-NNN`. | `statusReports`, `outcomes` |
| `InviteService` | Creates invite links (random token, 7-day expiry), lists, accepts and revokes invites. | `invites` |
| `UserService` | Lists users, changes a role, links a user to a customer, deletes a profile. | `userProfiles` |

Collection names live in `src/app/services/firestore-collections.const.ts`. The only page that writes to Firestore directly is `invite-signup.component.ts`, which creates the Auth account and the customer profile.

---

## Firestore Collections

| Collection | Holds | Who can read / write (`firestore.rules`) |
|---|---|---|
| `userProfiles/{uid}` | email, `role` (`admin` or `customer`), `isAdmin`, `customerId`, `inviteId`, `lastLogin` | The user or an admin reads; admins list. A user creates only their own customer profile, from a valid invite. A user cannot change `role`, `isAdmin`, `customerId`, `inviteId`, `uid` or `email`. Admins update and delete. |
| `customers` | `customerId` (`CUST-NNN`), company and contact details, `hourlyRate`, `isActive` | Admins, and that customer's users, read. Admins write. |
| `projects` | `projectId` (`PROJ-NNN`), `customerId`, name, `hourlyRate`, status | Admins, and users with the same `customerId`, read. Admins write. |
| `timeEntries` | `customerId`, `projectId`, date, start and end (to the minute), `durationHours`, `invoiceId`, status (`unbilled`, `billed`, `paid`) | As `projects`. |
| `invoices` | `invoiceNumber`, customer, dates, `timeEntryIds`, line items, totals, status (`draft`, `sent`, `paid`, `overdue`, `cancelled`) | As `projects`, for every status. |
| `statusReports` | `reportNumber`, customer, period, `timeEntryIds`, sections (project, activities, outcomes), status (`draft`, `sent`) | Admins only. |
| `outcomes` | One record per customer and project name: the running list of outcomes (`OutcomeRecord` model) | Admins only. |
| `invites/{token}` | email, customer, status, `createdBy`, `expiresAt`. The document ID is the token. | Anyone may open one invite by its token. Admins list, create, revoke and delete. The invited person may change their own pending invite to accepted. |

Every other path is denied. Composite indexes are in `firestore.indexes.json` (time entries, invoices, projects, customers).

### Access model

A Firebase Auth account alone gives no access: every rule checks the profile in `userProfiles`. `role == 'admin'` makes an admin. A customer reads only records with their profile's `customerId`. There is no self sign-up: a customer joins through an invite, and only an admin makes another admin. `src/app/firestore-rules.spec.ts` tests each rule.

---

## Core Features

- **Time entry**: start and end to the minute; hours are calculated. New entries are `unbilled`. Billed entries are locked in the list.
- **Invoices**: the wizard picks a customer and unbilled entries, creates a `draft` invoice at the project rate and marks the entries billed. Status moves to sent, then paid, which marks the entries paid. Cancelling releases the entries. A cancelled invoice can be reopened unless one of its entries was deleted or is on another invoice. PDF export uses jsPDF with the logo.
- **Status reports**: the wizard picks a customer and a period, loads the customer's outcomes, and calls `generateStatusReport`. The saved draft can be edited inline; outcome edits are written back to `outcomes`. Export to PDF and DOCX.
- **Dashboard**: active customers, unbilled hours, outstanding total, revenue this month, recent entries and invoices.
- **Hours report**: weekly hours per customer, or for all customers, with a PDF export.
- **Users and invites**: change a role, link a user to a customer, create, copy and revoke invite links.
- **Customer portal**: the customer's projects, time entries, hours, totals and invoices, with a read-only invoice view and PDF download.

### Rule: status report sections with no activities

A section with no activities is an orphan from an old outcomes record, usually after a project rename. It is removed in `generateStatusReport` and hidden on the detail page and in the PDF and DOCX exports. Do not bring it back. `AGENTS.md` explains the rule in full.

---

## Firebase Configuration

| Setting | Value |
|---|---|
| Project | `fta-invoice-tracking` |
| App URL | https://fta-invoice-tracking.web.app |
| Build output | `dist/fta-time-tracker/browser` |
| Hosting | All paths rewrite to `/index.html`. No custom headers. |
| Functions runtime | Node.js 22 (`engines.node` in `functions/package.json`) |
| Emulators | Auth 9099, Firestore 8080, UI 4000, single project mode |

### Cloud Function: `generateStatusReport`

- **Trigger**: HTTPS callable (`onCall`), `{ cors: true, timeoutSeconds: 300, memory: '512MiB' }`. The default 60-second timeout caused intermittent 504 errors, because the AI call takes 35 to 47 seconds.
- **Access**: signed-in admins only. It checks `userProfiles/{uid}.role` with `firebase-admin`.
- **Input**: `{ customerName, entries, priorOutcomes }`.
- **AI call**: model `claude-sonnet-5-5`, `max_tokens: 8192`, adaptive thinking with effort `medium`, and structured output with the `STATUS_REPORT_SCHEMA` JSON schema. An `AbortController` stops the call at 240 seconds and returns `deadline-exceeded`.
- **Reading the answer**: it takes the content block with `type === 'text'`, not `content[0]`, because a thinking block comes first.
- **Output**: `{ sections }`, with orphan sections removed and "Actual" outcomes first.
- **Secret**: `ANTHROPIC_API_KEY`, from `functions/.env`.

---

## CI/CD Pipeline

`.github/workflows/deploy-and-release.yml` runs on every push to `main`, which means every `git ship`. There is no path filter, so docs-only changes also deploy. Only one deploy runs at a time (`concurrency: deploy-<ref>`).

| Job | What it does |
|---|---|
| `version` | Works out the next version from the commit subjects (see `docs/standards/git-and-commits.md`). |
| `test` | Runs alongside `version`. Node 22 and Java 21, then `npm run test:ci` on the emulators. |
| `build` | Writes `src/environments/version.ts`, runs `npm run build:prod`, builds the functions, uploads the build. |
| `deploy` | Installs `firebase-tools@15.6.0`, signs in with Workload Identity Federation as `firebase-adminsdk-fbsvc@fta-invoice-tracking.iam.gserviceaccount.com`, writes `functions/.env`, and runs `firebase deploy --only hosting,firestore,functions`. |
| `release-notes` | Asks the Claude API (`claude-sonnet-4-6`) for release notes. If the call fails, it groups the commits by type. |
| `create-release` | Creates the git tag and the GitHub Release. |

- **Secrets**: `WIF_PROVIDER`, and the Claude API key under the name `ANTHTROPIC_API_KEY`. The extra `T` is the real secret name; do not correct it in one place only.
- **Certificate checks** stay on. The workflow never sets `NODE_TLS_REJECT_UNAUTHORIZED`.
- **Never deploy from a laptop.** `package.json` has no deploy scripts.

---

## Testing

- `npm test` runs the browser tests in watch mode, and `npm run test:ci` runs them once, headless. Both start the Auth and Firestore emulators with the project `demo-nta-browser`, which cannot reach production. Java must be installed.
- `npm run test:all` runs every suite. Today that is `test:ci`. Run it before `git ship`.
- 14 spec files: security rules, guards, services (auth, invites, invoicing, records, status reports), and pages (shell, sign-in, invite sign-up, time entry form, status report detail).
- Helpers in `src/testing/emulator-testing.ts`: emulator-connected Firebase objects, `signInAs(role)`, `clearEmulators`, and `seedDocument` and `readDocument`, which bypass the rules.
- The status report tests answer the callable function in the test. There are no tests for `functions/src` yet.

---

## Design System

- `src/styles.scss` imports `styles/_tokens.scss` (colours, spacing, fonts), `styles/_mixins.scss` (buttons, cards, forms, badges, breakpoints) and `styles/_components.scss` (shared classes).
- Component styles are inline SCSS that use the token variables. Primary colour: `$color-primary: #1E3A8A`.
- The PDF and DOCX exports repeat some colours as hex values, because they cannot read SCSS variables.

---

## Local Development

```bash
npm start
# App: http://localhost:4200 — this uses the LIVE fta-invoice-tracking project
```

```bash
npm test
# Browser tests on the Auth and Firestore emulators
```

```bash
cd functions && npm run serve
# Functions emulator only
```

---

## Known Gaps

These were found when this document was written on 2026-10-27. Each needs a decision before it is changed.

- **Customers can read draft invoices.** The rules and the portal show a customer every invoice with their `customerId`, including drafts.
- **`npm start` uses the live project.** No setting points `ng serve` at the emulators.
- **Record numbers are counted in the browser.** `CUST`, `PROJ`, `INV` and `RPT` numbers come from counting documents outside a transaction, so two saves at the same time could get the same number.
- **`overdue` is never set.** The status exists in the model and the filters, but no code sets it.
- **Function standards not yet met:** the model ID is written inline instead of as a constant, `stop_reason` is not checked, and there are no function tests (see `docs/standards/ai-features.md`).
- **The test job uses an older Firebase CLI.** It uses the `firebase-tools` devDependency (13.35.1); only the deploy job uses 15.6.0.
- **`firebase.json` has no `runtime`.** The Node version comes only from `engines.node`.

---

## Key File Reference

| File | Purpose |
|---|---|
| `src/app/app.routes.ts` | Routes and guards |
| `src/app/firebase.ts` | Firebase injection tokens |
| `src/app/services/firestore-collections.const.ts` | Collection names |
| `firestore.rules` | Security rules |
| `src/app/firestore-rules.spec.ts` | Security rule tests |
| `functions/src/index.ts` | `generateStatusReport` |
| `src/app/components/status-reports/status-report-detail.component.ts` | Report page and PDF and DOCX export |
| `src/app/services/invoice.service.ts` | Invoicing, cancel and reopen |
| `src/testing/emulator-testing.ts` | Test helpers |
| `.github/workflows/deploy-and-release.yml` | CI/CD |
| `AGENTS.md` | Rules for this app |

---

## Keeping This Doc Updated

Update this document in the same pull request as any of these changes (see `docs/standards/documentation.md`):

| Change | Section to update |
|---|---|
| A dependency added or a major version changed | Tech Stack |
| A route, page or guard added or changed | Project Structure, Routing |
| A service added or its job changed | Key Services |
| A Firestore collection or rule added or changed | Firestore Collections |
| A Cloud Function added or changed | Cloud Function |
| A feature added | Core Features |
| The Firebase or hosting setup changed | Firebase Configuration |
| The CI workflow changed | CI/CD Pipeline |
| A test suite or script added | Testing, Local Development |
| A known gap fixed | Known Gaps |

Change the "Last checked against the code" date at the top when you check the whole document.
