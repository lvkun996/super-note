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
