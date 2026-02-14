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

   This creates a PR, squash-merges it to main, and cleans up the branch.

4. **Never commit directly to main.** All changes go through feature branches and PRs. Merging to main triggers the deploy-and-release CI/CD pipeline.

## Project Notes

- Angular app deployed to Firebase Hosting via GitHub Actions.
- CI/CD pipeline: `.github/workflows/deploy-and-release.yml` triggers on push to main.
- The pipeline auto-versions (semver), builds, deploys to Firebase, generates AI release notes, and creates a GitHub Release.
