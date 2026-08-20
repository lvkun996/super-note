# Super Note left tab menu design QA

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
