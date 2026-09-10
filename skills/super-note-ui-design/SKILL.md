---
name: super-note-ui-design
description: Design, refine, or review Super Note desktop interfaces using the project's quiet, content-first visual language. Use for Super Note screens, panels, dialogs, navigation, editor surfaces, canvas UI, empty states, and dark-mode styling; do not use for business logic or release work.
---

# Super Note UI Design

Keep the interface calm, compact, desktop-native, and centered on the user's content. Prefer restrained neutral surfaces and precise hierarchy over decorative chrome.

Before making a visual decision, read [references/design-system.md](references/design-system.md). Apply the system by semantic role; do not copy a color or radius merely because it appears once in the source.

## Essential direction

- Keep navigation dense and quiet; keep editing and canvas surfaces flat, open, and edge-to-edge.
- Reserve elevation, translucency, blur, and larger corner radii for temporary layers such as dialogs, menus, command bars, search, and zoom feedback.
- Use blue for focus, links, selection, drag/drop, and actionable state—not as broad decorative fill.
- Preserve light and dark modes as deliberately paired palettes. Dark mode is deep navy with a subtle moss-toned navigation layer, not a simple inversion.
- Use motion as brief feedback. Honor reduced-motion and reduced-transparency preferences.
- Maintain the application's compact type and control density. Large expressive type belongs only to intentional empty or inspiration states.

## Boundaries


- Do not turn the product into a card-heavy dashboard, marketing page, or generic Ant Design admin UI.
- Do not introduce gradients, glass effects, or bright accent colors across persistent content surfaces.
- Do not change product behavior, information architecture, copy, data flow, or release configuration unless the user separately requests it.
- When an existing screen conflicts with this guide, preserve confirmed product semantics and use the closest visual role from the reference.

## Visual acceptance

Review the finished state at the target desktop size and, when relevant, below 980 px. Check normal, hover, focus-visible, selected, disabled, empty, overflow, and dark states. The result should feel quiet when idle and unmistakable when interactive.
