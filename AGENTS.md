# Super Note workspace conventions

Preserve unrelated uncommitted changes and installed application data.

## Publishing

- When the user explicitly requests a release, use the unified repository entry point: `npm.cmd run release` on Windows (`npm run release` elsewhere). It invokes `scripts/release.mjs`.
- Do not recreate the release workflow with separate packaging, tag, upload or Pages commands. The script validates, builds, packages, verifies, publishes and checks live deployment.
- Before invoking it, prepare the requested version in `package.json`, both version fields in `package-lock.json`, and `site/index.html` download/version references. Write the release notes to `docs/releases/v<version>.md`.
- Stage only files authorized for that release and commit them on `master`; the script intentionally refuses a dirty worktree. Never use `git add .`, force-push tags, or overwrite a published version.
- Use `npm.cmd run release -- --dry-run` to inspect the plan, and `npm.cmd run release:check` for local preflight. Neither mode publishes or builds.
- Default target is Windows 10/11. Include Win7/8 only when requested, via `npm.cmd run release:full` (also update its site download link).
- If interrupted before publication, use `--resume` only for the same commit's draft. After publication, use `--verify-only` to retry online verification without writes; do not republish assets.
- A script-editing request alone does not authorize a release, commit, push or version bump. Do not claim publication until the script confirms public assets, updater manifests and the live Pages version.
