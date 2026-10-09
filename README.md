# Super Note

Electron + React desktop note canvas.

## Current capabilities

- Text, Markdown, and freeform canvas tabs with multi-pane layouts.
- Mouse-drag tab reordering and a persistent `Ctrl+B` top/left tab layout.
- Local workspace recovery with atomic writes and an automatic backup.
- External file-change detection with reload or keep-current conflict handling.
- Recent files, `Ctrl+P` quick open, and search across open tabs and recent file names.
- Windows default-app and Explorer preview registration for supported text formats, tray controls, and in-app updates.

## Scripts

- Recommended Node: `22.12.0` or newer.
- `npm run dev` starts Vite and Electron for development.
- `npm run build` builds Electron main/preload and the React renderer.
- `npm test` runs the unit test suite once.
- `npm run test:watch` runs tests in watch mode.
- `npm run pack` creates an unpacked desktop build.
- `npm run dist` creates macOS/Windows packages through electron-builder.

On this machine, the global Node on `PATH` may be too old. Use nvm's Node 22 before running npm commands.

Development uses an isolated user-data directory under `.tmp-home`, so it can run alongside an installed copy without reading or overwriting the installed app's workspace.

## One-command release

Use Node 22.12+ and the existing installed dependencies. Prepare the version in `package.json`, both root version fields in `package-lock.json`, and the version/download links in `site/index.html`. Put release notes in `docs/releases/v<version>.md`, then commit the authorized release changes on `master`.

```powershell
npm.cmd run release
```

This is the standard Windows 10/11 release entry point. It runs type checks, unit tests, installer construction, packaged-entry verification, editor/chrome regression checks (native chrome on supported Windows only), and updater checksums. It pushes the version tag, uploads to a draft Release, verifies the assets, publishes it, then pushes `master` and waits for the exact commit's Pages deployment. Public downloads, their SHA-256 hashes, updater manifests and the live site's version/download link are checked before success is reported. Previous build outputs are preserved under `.cache/release-backups/`.

Credentials are resolved from `GH_TOKEN`, `GITHUB_TOKEN`, GitHub CLI login, or Git's credential helper; never put tokens in commands or source. GitHub access must permit repository contents writes and Actions/Pages reads. Build failures stop publication. Published versions and tags are never force-replaced, and the script does not automatically bump versions, stage or commit files.

Useful modes:

```powershell
npm.cmd run release -- --dry-run          # Plan only; no network or writes
npm.cmd run release:check                 # Local preflight only; requires clean master
npm.cmd run release:full                  # Also build/publish Win7/8; prepare its site link
npm.cmd run release -- --resume           # Continue an interrupted draft at the same commit
npm.cmd run release -- --verify-only      # Read-only online verification after publication
npm.cmd run release -- --notes-file notes.md --pages-timeout 900
```

If failure occurs after publication, the release may already be public. Keep the local build outputs, check the reported Actions/deployment error, and retry verification with `--verify-only`; do not replace published installers. Full-channel verification also needs `--with-win7-8`. `--help` lists the options, and existing `release:current` remains a compatible alias.
