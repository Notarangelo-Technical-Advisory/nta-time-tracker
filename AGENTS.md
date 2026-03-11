# Project Rules

## Git Workflow

Always follow this feature-branch workflow:

1. **Before making changes**, create and switch to a feature branch:

   ```bash
   git checkout -b <branch-name>
   ```

   Use conventional-commit-style branch names: `feat/add-timer`, `fix/invoice-total`, `refactor/auth-service`.

2. **Make commits on the feature branch** using conventional commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). The CI/CD pipeline uses these prefixes to determine version bumps:
   - `feat:` triggers a minor version bump
   - `fix:` triggers a patch version bump
   - `BREAKING CHANGE` or `[major]` triggers a major version bump

3. **When the work is complete and ready to ship**, run:

   ```bash
   git ship
   ```

   `git ship` squash-merges the feature branch into main and pushes to `origin/main` **first**, then attempts to create a GitHub PR for record-keeping, then deletes the branch. **The deploy to Firebase triggers on the push to main** — if the PR creation step fails (e.g., a `gh` token permissions error), the deploy has already been initiated. In that case, simply delete the remote branch manually:

   ```bash
   git push origin --delete <branch-name>
   ```

4. **Never commit directly to main.** All changes go through feature branches and PRs. Merging to main triggers the deploy-and-release CI/CD pipeline.

## Firebase Deployment

### Automatic Deployment (Preferred)

The app automatically deploys to Firebase when code is pushed to the `main` branch via the GitHub Actions workflow (`.github/workflows/deploy-and-release.yml`).

**What gets deployed:**

- **Hosting**: Angular app build to `https://fta-invoice-tracking.web.app`
- **Firestore Rules**: Security rules from `firestore.rules`
- **Firestore Indexes**: Database indexes from `firestore.indexes.json`

**Authentication**: Uses the `FIREBASE_SERVICE_ACCOUNT` GitHub secret (service account JSON).

### Manual Deployment (When Needed)

Use manual deployment to deploy changes without creating a new release (e.g., Firestore rules hotfix).

**Prerequisites:**

1. Authenticate with Google Cloud:

   ```bash
   gcloud auth application-default login
   ```

2. Set the quota project:

   ```bash
   gcloud auth application-default set-quota-project fta-invoice-tracking
   ```

**Commands:**

```bash
# Deploy everything (hosting + firestore rules/indexes)
npm run deploy

# Deploy only hosting
npm run deploy:hosting

# Deploy only Firestore rules and indexes
npm run deploy:firestore

# Deploy via non-interactive script
node deploy-non-interactive.js
```

### Troubleshooting

**Problem:** `Failed to authenticate` or `quota project` error

**Solution:**

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project fta-invoice-tracking
```

**Verify deployment:**

- Open [Firebase Console → Firestore → Rules](https://console.firebase.google.com/project/fta-invoice-tracking/firestore/rules)
- Check the timestamp to confirm rules were updated
- For hosting, visit `https://fta-invoice-tracking.web.app` and hard-refresh (Cmd+Shift+R)

## Project Notes

- Angular app deployed to Firebase Hosting via GitHub Actions.
- CI/CD pipeline: `.github/workflows/deploy-and-release.yml` triggers on push to main.
- The pipeline auto-versions (semver), builds, deploys to Firebase (hosting + firestore), generates AI release notes, and creates a GitHub Release.
