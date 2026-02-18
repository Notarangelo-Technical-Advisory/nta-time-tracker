# Contributing

## Commit Convention

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/). This is enforced by commitlint at commit time.

### Format

```
<type>[optional scope]: <description>

[optional body]
```

### Types

| Type | Version bump | Use for |
|---|---|---|
| `feat` | minor | New user-facing feature |
| `fix` | patch | Bug fix |
| `perf` | patch | Performance improvement |
| `docs` | none | Documentation only |
| `refactor` | none | Code restructuring, no behavior change |
| `chore` | none | CI config, husky hooks, commitlint — never source files |
| `style` | none | Formatting only |
| `test` | none | Adding or fixing tests |

### Breaking changes

Append `!` to the type or add `BREAKING CHANGE:` in the body to trigger a major version bump:

```
feat!: redesign time entry flow
```

### Examples

```
feat(invoices): add PDF export
fix: correct time rounding on weekly summary
fix: update displayed model name in time entry output
chore: add commitlint and husky hooks
docs: update deployment instructions
refactor(api): extract time entry service
```

### When in doubt

Ask: *"Would a user notice this change in the app or its output?"* If yes → `fix` or `feat`. If no → `refactor`, `docs`, or (rarely) `chore`.
