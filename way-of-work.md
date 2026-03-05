# PlaDuk — Way of Work

## Git Workflow

1. **Pick an issue** from GitHub Issues. Assign it to yourself.
2. **Create a branch** from `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/#<issue-number>-short-description
   # Example: feat/#12-bill-creation-wizard
   ```
3. **Work on your branch.** Commit often with clear messages:
   ```
   feat: add bill creation wizard step 1
   fix: handle empty member list edge case
   refactor: extract member chip component
   ```
   Format: `<type>: <what you did>` — types are `feat`, `fix`, `refactor`, `style`, `docs`, `test`.
4. **Before creating a PR**, update your branch with the latest `main`:
   ```bash
   git fetch origin
   git merge origin/main
   # If there are conflicts, fix them, then:
   git add .
   git commit -m "merge: resolve conflicts with main"
   ```
5. **Push and create a Pull Request**:
   ```bash
   git push -u origin feat/#12-bill-creation-wizard
   # Then open a PR on GitHub targeting main
   ```
6. **Get at least one review** before merging. Use **squash merge** on GitHub.

## Rules

- Never push directly to `main`
- One feature per branch, one branch per issue
- Resolve your own merge conflicts before requesting review
- Run `pnpm turbo build` before pushing — make sure it compiles
