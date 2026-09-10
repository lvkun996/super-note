# Super Note UI Design System

This reference captures the established visual language of the Super Note Electron/React application. It describes UI design only; it does not authorize behavior, architecture, persistence, packaging, publishing, or business changes.

## 1. Design character

Super Note is a quiet desktop workspace: compact around the edges, spacious where content lives, and expressive only in moments that invite creation.

Use these qualities together:

- **Content first:** document, Markdown, and canvas content receive the largest uninterrupted surfaces.
- **Desktop native:** compact title bar, tabs, menus, controls, and separators; avoid oversized mobile-style controls.
- **Soft precision:** hairline boundaries, low-contrast neutrals, restrained shadows, and clear focus rings.
- **Layered restraint:** persistent structure is flat; temporary UI may float with blur and shadow.
- **Selective personality:** playful display type and atmospheric color belong to empty/inspiration states, not routine editing.

## 2. Spatial model and density

### Persistent application chrome

| Element | Established measure | Design intent |
| --- | ---: | --- |
| Window title bar | 32 px | Compact native frame; menu and window controls remain visually quiet. |
| Top tab strip | 32 px overall; 31 px controls | Seamless continuation of the title bar/navigation layer. |
| Default left sidebar | 220 px | Narrow navigation rail, resizable when needed. |
| Sidebar header | 34 px | Small utility zone, not a page heading. |
| Sidebar tab row | 31 px | Dense scan-friendly list. |
| Document title row | 46 px | The only clear boundary between navigation and document content. |
| Title-row icon buttons | 28 × 28 px | Compact actions with 6 px corners. |

Structural regions meet edge-to-edge. App shell, work panes, document surfaces, split panes, title bars, and top tabs normally use `border-radius: 0` and no exterior card shadow.

### Spacing rhythm

Use a compact 4 px-based rhythm:

- 2–6 px for gaps inside dense navigation and menus.
- 8–12 px for related controls and compact rows.
- 14–20 px for panel and title-row spacing.
- 22–36 px for dialog and reading-surface padding.
- 48–64 px only for immersive overlays, reading bottoms, or expressive empty states.

Do not add padding around the main workspace merely to make it look like a web dashboard.

## 3. Color system

Use colors by role. Existing values are reference anchors, not a license to introduce many near-duplicates.

### Light mode

| Role | Reference | Usage |
| --- | --- | --- |
| Main content surface | `#FFFFFF` | Documents, canvas, Markdown preview, panes. |
| Navigation surface | `#F3F3F3` | Title bar, tabs, sidebar; may carry a barely perceptible sage character. |
| Subtle alternate surface | `#FAFBFC` / `#FBFCFE` | Source panes, quiet grouped content. |
| Primary text | `#1F2329` / `#202124` | Titles and body content. |
| Secondary text | `#596473`–`#7A8596` | Descriptions, metadata, placeholders. |
| Hairline divider | `#E5E8EF` / `#E7EBF2` | Persistent structure and section boundaries. |
| Focus/action blue | `#1677FF` | Links, focus, active status, drag/drop, selection. |
| Search highlight | `#FAAD14` / `#FFE58F` | Search target and text matches only. |
| Destructive red | `#D92D20` | Destructive action text/feedback only. |

### Dark mode

| Role | Reference | Usage |
| --- | --- | --- |
| Main content surface | `#101722` / `#111821` | Documents, canvas, panes. |
| Navigation surface | `linear-gradient(180deg, #172621 0%, #1B241F 52%, #25251D 100%)` | Title bar, tabs, sidebar only. |
| Raised/alternate surface | `#141D28` / `#182230` | Search, cards inside informational overlays, source regions. |
| Primary text | `#E8EEF7` / `#EDF3FB` | Titles and body content. |
| Secondary text | `#94A1B3`–`#A9B6C8` | Descriptions, metadata, placeholders. |
| Hairline divider | `#263344` / `#283648` | Structure and section boundaries. |
| Focus/action blue | `#72ADFF` or a brighter blue state | Links and interaction feedback. |

Avoid pure black as the main dark surface. Avoid large saturated fields in either theme.

### Accent discipline

- Blue communicates interaction or state; it should not become the general background color.
- Multicolor accents may distinguish tabs, mind-map branches, or the expressive empty state.
- A tab accent is a narrow marker or status dot, not a filled tab.
- Neutral primary buttons are near-black on light glass and near-white on dark glass. This keeps dialogs visually calm.

## 4. Typography

### Functional interface

Use the system stack:

`-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`

Recommended hierarchy:

- 11 px: compact labels, pane labels, shortcut hints, tertiary metadata.
- 12 px: tabs, menus, tooltips, helper text.
- 13 px: default editor/UI text and settings descriptions.
- 14 px: document title and comfortable standard controls.
- 15–19 px: section headings and dialog titles; dialog title is approximately 19 px/700.
- Markdown reading text: approximately 15–16 px with `1.72–1.78` line height.

Use weight 600–700 for hierarchy. Avoid excessive bolding; body text stays regular.

### Special type

- Use `JetBrains Mono`, `SFMono-Regular`, Consolas, or equivalent only for code, shortcuts, and numeric/version display.
- The hand-drawn stack (`ZCOOL KuaiLe`, `Ma Shan Zheng`, then cursive fallbacks) is reserved for the optional handwritten mode and expressive empty/inspiration headlines.
- Large display sizes such as 48–64 px are exceptional. They must not leak into routine editor, settings, or navigation UI.

## 5. Shape, borders, and elevation

### Corner-radius hierarchy

- `0`: structural chrome, split panes, title bars, top tabs, full-screen experiences.
- `4–6 px`: dense controls, tab rows, inline code, compact list items.
- `7–10 px`: inputs, feedback chips, search results, small contextual surfaces.
- `12–14 px`: floating command bars, dropdowns, modal cards.
- `999 px`: status dots, pills, handles, and circular affordances only.

### Borders

- Prefer 1 px low-contrast borders or dividers.
- Use a stronger border or a 2–3 px translucent ring for focus and selection.
- Do not box every content group. Use spacing and a single divider to express hierarchy.

### Shadows

- Persistent surfaces: none or extremely subtle inset focus.
- Selected sidebar row: roughly `0 1px 4px` at low opacity.
- Small floating menu/indicator: roughly `0 8px 24px`.
- Dialog/search/command bar: roughly `0 14px 38px` or `0 18px 40px` at restrained opacity.
- Immersive image overlay may use a deeper shadow because the surrounding mask is dark.

Shadows must indicate elevation, not decorate every rectangle.

## 6. Surface patterns

### Navigation and tabs

- Navigation reads as one continuous layer across the title bar and tab/sidebar region.
- Top tabs are rectangular and edge-aligned. Active state is a subtle lightening, not a raised browser-tab capsule.
- Sidebar tabs use 6 px corners, a faint border, and a very soft shadow only when active.
- Keep labels on one line with ellipsis. Close controls may stay hidden until hover, active, or dirty state.
- Drag/drop feedback uses a 2 px blue insertion line and a faint outer glow.
- Use thin resizers with a larger invisible hit target and a restrained visible hover line.

### Document and editor surfaces

- The title row is clean and compact: primary action, title, then overflow actions.
- Keep the text/Markdown body centered for reading (`max-width` around 820 px) while source editing can use the full pane.
- Reading surfaces use generous vertical breathing room and high line height, while chrome remains compact.
- Markdown headings use weight and spacing first; H1/H2 may use a quiet bottom divider.
- Code blocks are neutral gray/navy; inline code may use a restrained magenta text accent.

### Canvas and mind map

- Use a full-bleed white/deep-navy canvas with a 24 px dot grid.
- Canvas objects remain visually lightweight until selected or edited.
- Text notes are transparent at rest; selection can change text color or add a focus ring instead of adding a permanent card.
- Mind-map root nodes may use solid branch color and stronger elevation. Child nodes stay white/soft-tinted with colored outlines.
- Floating canvas commands use a translucent 12 px-radius bar with blur and a controlled shadow.

### Dialogs and temporary layers

- Standard dialogs use a translucent neutral surface, 14 px radius, 22–24 px padding, and soft blur.
- Modal mask: approximately 24% black plus only a small background blur.
- Dropdowns use 12–13 px type, 5 px outer padding, 8 px item radius, and compact 30 px rows.
- A particularly dense tab menu may reduce item height toward 26 px, but should remain legible and aligned.
- Confirmation dialogs omit decorative status icons when the title and action already communicate intent.
- Full-screen inspiration/version surfaces explicitly drop card padding and radius and fill the viewport.

### Settings and help

- Each row has a strong label and a quieter one-line or short supporting description.
- Align the control to the right; let long path fields span a full row when necessary.
- Separate rows with hairline dividers instead of wrapping each row in a card.
- Use 12 px muted helper text and 16 px horizontal row gaps.

### Search and feedback

- Global search floats near the top center, no wider than about 640 px, with an 8 px radius and clear elevation.
- Search results are transparent at rest and use a pale blue/navy hover surface.
- Zoom feedback is a compact translucent pill-like panel with tabular numerals.
- Tooltips are dark translucent surfaces at 12 px with blur.

### Empty and inspiration states

- This is the one deliberately expressive area: subtle 28 px grid, diffused multicolor glow, centered copy, and optional hand-drawn display type.
- Keep color atmospheric and low-opacity. Content must remain dominant and readable.
- Use the animation slowly (around 16 seconds) and remove it under reduced-motion.
- Do not reuse this treatment behind active editing content.

## 7. Interaction and motion

- Hover/focus transitions: about `120–160ms`, generally `ease` or `ease-out`.
- Pressed state may scale to `0.98` for compact tactile controls.
- Dragging objects may reduce opacity to about `0.42` and scale slightly to `0.97`.
- Focus-visible uses a 2 px blue outline or a translucent 2–3 px ring; never rely on color alone when the control otherwise disappears.
- Animate feedback, not layout decoration. Avoid large springy movement in core desktop chrome.
- Under `prefers-reduced-motion: reduce`, remove nonessential transitions and animations.
- Under `prefers-reduced-transparency: reduce`, replace glass surfaces with opaque theme-matched fills.

## 8. Responsive behavior

The primary experience is desktop and normally expects at least 900 × 640 px. When narrower layouts are intentionally supported:

- Below roughly 980 px, remove the hard minimum width.
- Stack split Markdown source/preview panes vertically.
- Hide redundant pane labels when the stacked arrangement makes them obvious.
- Collapse two-column help/settings layouts to one column.
- Reduce expressive empty/inspiration type from 64/48 px toward 42/34 px.
- Preserve readable 20 px horizontal content padding.

Do not make desktop chrome oversized in an attempt to mimic a mobile app.

## 9. Composition rules

### Do

- Let content occupy the canvas without a surrounding card.
- Use hierarchy through spacing, typography, one-pixel separators, and a small number of semantic accents.
- Pair every important light-mode decision with a deliberate dark-mode value.
- Keep actions close to the object or title they affect.
- Make interactive states quiet at rest and clear on hover/focus/selection.

### Avoid

- Card grids, dashboard statistics, thick borders, and ornamental containers.
- Large colored headers or persistent gradients outside navigation and expressive empty states.
- Excessive pills, excessive blur, or shadows on non-floating surfaces.
- Default Ant Design appearance when it conflicts with the neutral, compact system.
- Random radii, arbitrary spacing, or multiple competing accent colors.
- Centered marketing copy inside normal work panes.

## 10. Visual review checklist

- Persistent chrome is compact; content surfaces are spacious and flat.
- The active item is visible without becoming loud.
- Text truncation, long Chinese/English labels, and overflow remain composed.
- Light and dark surfaces preserve the same hierarchy.
- Hover, pressed, focus-visible, selected, dirty, dragging, disabled, and empty states are designed.
- Dialogs and menus feel elevated; normal panes do not.
- Reduced-motion and reduced-transparency alternatives remain usable.
- At the target viewport, there is no unintended horizontal overflow or clipped primary action.

## 11. Canonical source anchors

When working inside the Super Note repository, treat these as the current visual evidence and reconcile this reference if they intentionally change:

- `src/styles.css`: application chrome, tabs/sidebar, canvas, editors, Markdown, search, settings, help, and responsive rules.
- `src/features/overlays/overlayStyles.css`: shared dialog, dropdown, popup, and control treatment.
- `src/features/mindmap/mindMap.css`: mind-map nodes, relations, and floating canvas commands.
- `src/features/mindmap/mindMapStylePanel.css`: compact property-window patterns.
- `design-qa.md`: latest recorded visual comparison and acceptance notes.

Screenshots are acceptance evidence for a specific state, not universal tokens. Prefer the semantic rules above when extending the interface.
