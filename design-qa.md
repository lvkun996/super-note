# Super Note welcome page and left-layout corner QA — 2026-09-03

## Scope and evidence

- Source visuals: `C:/Users/lv_ku/AppData/Local/Temp/codex-clipboard-e7ff83af-4d47-4d13-9142-63c09ce7615e.png` (welcome copy) and `C:/Users/lv_ku/AppData/Local/Temp/codex-clipboard-a04c8662-7abe-4afe-b773-321f082c265d.png` (left-layout top edge).
- Browser preview: local Electron/Vite preview at `http://127.0.0.1:5173/`, light and dark themes, top and left tab layouts.
- The welcome copy renders as `你想让我们在 super-note 中构建什么？` at 28px with a dark neutral color; `super-note` keeps the reference underline.
- Left layout renders a 16px upper-left radius with a square upper-right edge; the title row and editor remain clipped by the same container.

## Interaction verification

- Welcome state has no selected tab; clicking a tab enters the editor and clicking the Super Note brand returns to the welcome state.
- Top layout places the editor directly below the tabs without the document title bar.
- Light/dark theme rendering and left/top layout switching were inspected in the browser preview.

final result: passed

---

# Super Note v0.1.20 text title bar QA — 2026-09-03

## Scope and evidence

- Source: `C:/Users/lv_ku/AppData/Local/Temp/codex-clipboard-4d51d3c7-269d-43e7-b9f9-998855e4f46f.png` (636 × 260 pixels).
- Browser-rendered detail: `D:/code/super/super-note/.cache/title-detail-020.png` (343 × 906 pixels).
- Full app / dark top tabs: `D:/code/super/super-note/.cache/title-dark-020.png` (343 × 906 pixels).
- Full app / light left tabs was inspected before the focused comparison; existing 220px sidebar is intentionally preserved instead of cloning the unrelated source sidebar.
- Comparison used the source and implementation images together in the same tool output. Compare their native-scale title regions: source x=94,y=46 and implementation x=0,y=8. Both title rows are 46px high. Only the title region is the visual target, not the source app's outer chrome or blank-page height.
- State: light theme, same Chinese/English document title, empty editor. The fixture renders the production FileView and styles. Full application testing additionally covers top/left layouts and dark theme.

## Findings and comparison history

- Initial fixture capture had a white parent because it did not inherit the app navigation token. Corrected the fixture to use the existing app shell; the final capture exposes the same pale navigation background behind both 16px top corners. No production palette was replaced.
- Final comparison: no actionable P0/P1/P2 differences in the requested title region. Round upper corners, folder icon, single-line title, nearby ellipsis and fine divider match the reference structure.
- Typography: existing system sans font, 14px/600 title with 20px line height. Narrow panes ellipsize the title while keeping the menu visible.
- Spacing: 20px horizontal inset, 12px icon/title gap, 46px header, 16px upper radii; lower editor corners remain square.
- Colors: white title surface and fine gray divider, existing light navigation background around the corners. Dark mode uses the existing text/editor colors.
- Assets: no raster assets are required by this UI. Folder and ellipsis use existing Ant Design icons, not custom drawings.
- Copy: title follows the same display name as the tab; empty title fallback is 未命名文本. Source screenshot wording was used only as test data.

## Interaction and regression verification

- In-app browser: title menu opens; rename updates both title and tab; pin appears in the left Pinned group; unsaved documents disable Open containing folder; top/left and light/dark presentation inspected.
- Isolated Electron fixture: continuous typing, Unicode insertion, selection replacement, tab return/scroll restoration, middle-button multi-caret glyph coordinates, scrolling, insertion/deletion and Escape pass. Title height/radius/menu assertions added.
- Renderer logs checked by the regression runner; only existing development/deprecation warnings, no application error in the passing run.
- Remaining acceptance gap: no installation over the user's running client and no native Explorer launch from the browser-only preview. Existing Explorer handler is reused.

## Implementation checklist

- [x] Title bar with current name and functional menu.
- [x] Rounded top edge and independent text scrolling.
- [x] Static, out-of-flow multi-carets and typing fix included.
- [x] Narrow-pane and dark-mode checks.

final result: passed

---

# Archived: Super Note left tab menu design QA

## Evidence

- Source visual truth: `C:\Users\lv_ku\AppData\Local\Temp\codex-clipboard-7624ec06-c1e8-49a9-a260-b77616777406.png`
- Implementation screenshot: `D:\code\super\super-note\.tmp-left-tabs-final.png`
- Focused sidebar crop: `D:\code\super\super-note\.tmp-left-sidebar-final.png`
- Combined comparison: `D:\code\super\super-note\.tmp-design-compare-final.png`
- Browser viewport: 1320 × 867 CSS px, device scale factor 1
- Source pixels: 222 × 831
- Implementation sidebar pixels/CSS size: 220 × 831, cropped below the 36px app title bar
- State: light theme, left tab layout, long mixed Chinese/English titles, active tab, two content panes

## Full-view comparison

The full application view confirms that the 220px sidebar remains fixed while the editor and multi-pane workspace retain the remaining width. Switching layouts does not remount the editor surface. No persistent controls overflow the 1320 × 867 viewport.

## Focused comparison

The combined comparison places the 222 × 831 source beside the 220 × 831 implementation. Both use a compact vertical rhythm, single-line ellipsis, a pale green-to-warm-white background, and a narrow desktop sidebar proportion. A focused comparison is required because the source only depicts the sidebar.

## Required fidelity surfaces

- Fonts and typography: the implementation uses the app's system sans stack, 13px compact labels, stable 31px rows, and one-line ellipsis. This matches the source's dense Windows list character.
- Spacing and layout rhythm: 220px width matches the 222px source; list rows keep an even 31px rhythm and independent vertical scrolling.
- Colors and tokens: the light sidebar follows the source's pale green-to-cream field. Dark mode has a separate high-contrast green-charcoal treatment.
- Image quality and assets: the target contains no imagery, logos, or custom raster assets. Existing Ant Design icons are used only for functional create/close controls.
- Copy and content: realistic mixed Chinese/English tab titles verify truncation and scanning behavior.

## Findings

- No actionable P0, P1, or P2 mismatch remains.
- P3: the implementation adds a compact “标签” header and create action that are absent from the crop. This is an intentional product constraint so the existing new-tab behavior remains available in left layout.
- P3: active/dirty state accents are more explicit than the reference. They preserve Super Note's existing tab status language and improve wayfinding.

## Interaction verification

- `Ctrl+B` switched from top tabs to the left menu while the editor was focused, and switched back successfully.
- `Ctrl+B` was ignored while Quick Open and Settings were active.
- Left-mode pointer drag reordered tabs; the order persisted after reload.
- Top-mode pointer drag reordered tabs.
- Split view remained at two panes with one global left tab menu and one split resizer.
- Closing a tab from the global left menu removed it without collapsing split view.
- Dark mode rendered the sidebar correctly.
- Browser console errors checked: none.

## Comparison history

- Pass 1: overall proportions, density, typography, and palette had no P0/P1/P2 differences. Functional drag verification exposed that browser-native HTML drag was not reliably testable.
- Fix: replaced native tab dragging with a 6px-threshold pointer interaction, continuous before/after insertion feedback, and a single reorder commit on pointer release.
- Final pass: both left and top layouts reordered with mouse drag, persisted after reload, and retained the accepted visual treatment.

## Final result

final result: passed
# Super Note v0.1.22 UI QA — 2026-09-04

## Scope and evidence

- Reviewed the requested welcome-page, navigation, editor, tray-menu, and middle-button multi-caret refinements against the supplied screenshots and the local renderer preview at `127.0.0.1:5174`.
- Checked both light and dark editor rendering plus top and left tab layouts. The tray popup geometry was verified from the Electron positioning and sizing path.

## Findings

- Welcome copy keeps the requested 28px dark neutral treatment and `super-note` no longer has an underline.
- Light navigation, title, and sidebar surfaces use `#F3F3F3`; the text editor surface uses `#FFFFFF`.
- Tray menu dimensions are reduced and the popup is positioned with an 8px gap away from the tray icon.
- Middle-button multi-caret markers are static 1px native text/caret colors without a blue overlay; the edit history path preserves the pre-edit content so Ctrl+Z restores it after input.

Final result: passed
# Super Note v0.1.23 UI QA — 2026-09-04

## Scope and evidence

- Reviewed the supplied top-layout screenshots and the reported multi-row middle-button editing regression in the local renderer preview.

## Findings

- Top layout file content no longer inherits the rounded gray strip above the title bar: the pane is square, flush, and white.
- Multi-caret edits keep a local content/caret snapshot; Ctrl+Z restores both the previous text and the corresponding primary/multi-caret positions without enabling the blinking overlay.

Final result: passed
