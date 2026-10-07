# NTA Time Tracker — Agent Instructions

This app follows the shared engineering standards in [`docs/standards/`](docs/standards/README.md), copied from [`engineering-standards`](https://github.com/Notarangelo-Technical-Advisory/engineering-standards) `v1.0.0`. Do not edit `docs/standards/` in this repo. Change the standards repo instead.

This file holds only the rules that belong to this app.

## Git and deployment

- Use a branch and `git ship`, as in [`docs/standards/git-and-commits.md`](docs/standards/git-and-commits.md). The pull request needs no review.
- Every merge to `main` deploys to production through `.github/workflows/deploy-and-release.yml`. The workflow has no path filters, so a docs-only change also deploys.
- Never deploy from a laptop. This also applies to a fix to the Firestore rules.

## Firebase

- **Project:** `fta-invoice-tracking`
- **App URL:** `https://fta-invoice-tracking.web.app`
- **Deployed by CI:** `firebase deploy --only hosting,firestore,functions` (hosting, `firestore.rules`, `firestore.indexes.json`, and the Cloud Functions in `functions/`)
- **CI sign-in:** Workload Identity Federation, as the service account `firebase-adminsdk-fbsvc@fta-invoice-tracking.iam.gserviceaccount.com`
- **Secret name:** the GitHub secret for the Claude API key is spelled `ANTHTROPIC_API_KEY`, with an extra `T`. The workflow uses the same spelling, so do not correct it in one place only.
- **Check a deploy:** open `https://fta-invoice-tracking.web.app` and reload with Cmd+Shift+R. For rules, check the timestamp in the [Firebase console](https://console.firebase.google.com/project/fta-invoice-tracking/firestore/rules).

## Testing

- `npm run test:all` runs every suite. Today that is `test:ci`: the browser tests on the Firebase Auth and Firestore emulators (project `demo-nta-browser`), with real accounts and the real `firestore.rules`.
- Helpers for signing in as an admin or a customer, and for seeding documents, are in `src/testing/emulator-testing.ts`.

## Access model

`firestore.rules` grants everything from a user's profile (`userProfiles/{uid}`): `role` makes an admin, and `customerId` decides which customer's records a customer can read. So:

- Only an admin can set `role`, `isAdmin` or `customerId`. A user may update other fields on their own profile, for example `lastLogin`.
- There is no self sign-up. A customer joins through an invite link. Only another admin can make an admin.
- An invite's document ID is its token. Anyone with the link can open that one invite, and only admins can list invites. The invited person may create a customer profile that matches the invite, and mark that invite accepted.

`src/app/firestore-rules.spec.ts` checks each of these. Keep it passing when you change the rules.

## Domain rules

### Status reports: a section with no activities is an orphan

Report sections (`StatusReportSection`) are keyed by `projectName`. Activities always come from the reporting period's time entries, grouped by project. Outcomes persist across reports in the `OutcomeRecord` collection, one record per customer and project. That collection is the cumulative record of prior outcomes that is sent to the model.

**Rule: a section with no activities is an orphan, not real content.** It appears when a prior `OutcomeRecord` has no matching time entries this period. This happens most often after a project rename leaves an old record under the old name. The model then returns that record as a section with no activities, which repeats outcomes already carried into the active section. `upsertOutcomes` then saves it again, so it comes back in every report.

Sections with no activities are therefore removed in three places. **Do not "restore" them:**

- `functions/src/index.ts`: `generateStatusReport` drops them before it returns, so new reports do not save the orphan again.
- `src/app/components/status-reports/status-report-detail.component.ts`: the page render (an `@if` inside the `@for`, which keeps the true section index for inline edits), **and** both the PDF and DOCX export loops.

If the outcomes of a renamed project must be kept, merge the old `OutcomeRecord` into the active project's record and delete the old one. Never bring back a section with no activities.
