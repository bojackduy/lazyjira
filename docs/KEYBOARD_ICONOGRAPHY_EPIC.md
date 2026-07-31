# Keyboard Integrity And Terminal Iconography Epic

## Goal

Make keyboard paging predictable and make Jira hierarchy, issue types, routes, and state easier to scan with a consistent terminal icon language.

Keyboard correctness comes first. Icon work must not hide selection, focus, scrolling, or input-capture regressions.

## Reported Problems

- Plain `d`/`u` do not page through Timeline or List even though other lazy-style surfaces use them.
- Page movement can appear detached from the cursor if scrolling changes without moving the selected item, or if the selected item moves without being brought into view.
- Route-local shortcuts can remain active beneath onboarding and steal printable characters from URL, email, or token inputs.
- Selection and collapse currently reuse `>`, making the active row and a collapsed branch visually ambiguous.
- Issue types, statuses, priorities, hierarchy, routes, and actions use a small set of generic markers such as `■`, `●`, and `◆`.
- Directly scattering Nerd Font characters through render components would make fallback behavior and terminal-width bugs difficult to control.

## Product Decisions

### Selection-Driven Paging

- Plain `d` and `u` move the selected row by half of the visible viewport in Timeline and List.
- `Ctrl-d` and `Ctrl-u` remain supported aliases.
- Paging moves selection first; the scrollbox then brings the selected row into view.
- Timeline paging includes issue rows, the virtual Unparented issues section, and the create row.
- Paging clamps at the first and last selectable rows.
- Timeline and List do not use detached raw scrolling for `d`/`u`.

### Input Owns Printable Keys

- A focused text input owns printable keys, including `d`, `u`, `j`, `k`, `h`, and `l`.
- Route-local bindings are inactive while onboarding, search, project picker search, command palette, comments, detail-body editing, config editing, or another text editor is active.
- Route-local bindings are also inactive beneath modal review, help, staged-discard, and remote-apply surfaces.
- Popup-specific navigation remains active only inside the popup that owns it.
- Onboarding keeps `Enter` for continue/save and `Esc` for close while allowing all other printable input.

### Semantic Icon Profiles

- Icons are resolved from one semantic catalog rather than embedded directly in components.
- `unicode` is the default profile and must work without a patched font.
- `nerd` is an explicit enhanced profile for users with a Nerd Font.
- `ascii` is the strict compatibility profile.
- Font support is never auto-detected because terminal font glyph coverage cannot be determined reliably.
- The initial override is `LAZYJIRA_ICON_MODE=nerd|unicode|ascii`; invalid values fall back to `unicode` with no startup failure.

### Visual Semantics

- Selection and disclosure use different symbols.
- Collapsed, expanded, leaf, missing-parent, and invalid-hierarchy rows have distinct indicators.
- Issue-type shape comes from normalized Jira metadata while color continues to come from Jira metadata when available.
- Status icons communicate workflow category or exceptional state; existing semantic status colors remain authoritative.
- Priority icons communicate direction or severity while Jira priority color remains authoritative.
- Board cards remain restrained: one issue-type icon plus exceptional blocked/stale state is enough.
- Icons supplement labels; they do not replace required text in narrow layouts, errors, or destructive confirmations.

## Icon Catalog

The catalog should expose semantic names, not font-specific names:

| Semantic token | Nerd profile | Unicode profile | ASCII profile |
|---|---|---|---|
| `selection` | Nerd selection marker | `▌` | `>` |
| `collapsed` | Nerd chevron right | `▸` | `>` |
| `expanded` | Nerd chevron down | `▾` | `v` |
| `leaf` | Nerd small-circle marker | `·` | `.` |
| `create` | Nerd plus icon | `+` | `+` |
| `missingParent` | Nerd broken-link/help icon | `?` | `?` |
| `invalidHierarchy` | Nerd warning icon | `!` | `!` |
| `statusTodo` | Nerd empty-circle icon | `○` | `o` |
| `statusInProgress` | Nerd active-circle icon | `◉` | `*` |
| `statusDone` | Nerd check-circle icon | `✓` | `x` |
| `statusBlocked` | Nerd warning icon | `!` | `!` |

Nerd glyphs must be chosen during implementation from single-cell glyphs verified in the supported terminals. The plan intentionally records semantic names rather than unstable private-use code points.

## Issue-Type Resolution

Resolve an issue-type icon in this order:

1. Exact normalized names for common Jira types such as Bug, Story, Task, Epic, Feature, Initiative, and Subtask.
2. Jira's `subtask` metadata.
3. Positive `hierarchyLevel` metadata for portfolio/parent work.
4. Generic issue fallback.

Custom Jira type names remain visible. The icon is only a scan aid and never changes the canonical Jira issue-type ID used by writes.

## Architecture

### Keyboard Context

Add one pure shared predicate for whether route-level shortcuts are blocked. Route components use that predicate when registering bindings and keep command-level guards as a second safety boundary.

The predicate covers:

- Onboarding.
- Search and project picker input.
- Command palette and help.
- Comment and detail-body editors.
- Inspector and config editing.
- Staged-discard and remote-apply dialogs.

### Icon Context

Add a small icon module that provides:

- The selected icon profile.
- Semantic structural icons.
- Route and action icons.
- Issue-type resolution from name, hierarchy level, and subtask metadata.
- Status and priority icon resolution.

Components consume semantic icons and continue resolving colors through the existing selectors and theme.

## Delivery Order

### Phase 1: Keyboard Integrity

- Add the shared route-binding blocker.
- Apply it to every route-local binding layer.
- Add plain `d`/`u` to Timeline and List while preserving Ctrl aliases.
- Keep Timeline/List paging selection-driven and bring the destination row into view.
- Fix onboarding input ownership.
- Update route hints and keyboard help.

### Phase 2: Structural Icons

- Add icon profiles and environment selection.
- Separate selection from collapsed/expanded disclosure.
- Apply structural icons to Timeline, List, Backlog groups, and create rows.
- Preserve missing-parent and invalid-hierarchy distinction.

### Phase 3: Jira And Navigation Icons

- Add issue-type icon resolution.
- Apply issue-type icons consistently to Board, Backlog, List, Workspace, Detail, Inspector, and metadata legends.
- Add restrained status, priority, blocked, stale, parent, route, and action icons.
- Preserve text labels and Jira colors.

### Phase 4: Compatibility And Polish

- Verify single-cell alignment for every profile.
- Verify wide and narrow layouts.
- Verify Nerd Font, ordinary Unicode font, and ASCII terminals.
- Update README setup and screenshots after the visual language stabilizes.

## Testing Strategy

- Unit-test the shared route-binding blocker for every modal and editor state.
- Use OpenTUI test input to prove onboarding accepts shortcut letters without moving the underlying route.
- Test plain and Ctrl `d`/`u` aliases in Timeline and List.
- Capture frames after paging to prove the selected destination row is visible.
- Cover wide and narrow Timeline, including the Unparented issues section and create row.
- Unit-test icon profile selection and invalid-profile fallback.
- Unit-test issue-type resolution for common, custom, subtask, hierarchy-level, and unknown types.
- Assert every structural icon occupies one terminal cell in each profile.
- Render-test Board, Backlog, List, Timeline, Workspace, Detail, and Inspector with Unicode, Nerd, and ASCII profiles.

## Acceptance Criteria

- `d`/`u` and `Ctrl-d`/`Ctrl-u` move Timeline and List selection by half a viewport.
- The destination selection is visible after every page move.
- Paging never leaves the cursor pointing at an off-screen row.
- Onboarding URL, email, and token inputs accept all printable shortcut letters.
- Typing in onboarding does not move or scroll the route behind it.
- Selection, collapsed, expanded, leaf, missing-parent, and invalid-hierarchy indicators are visually distinct.
- Jira issue types have consistent semantic icons and retain Jira-provided colors.
- Unicode and ASCII profiles remain fully usable without a Nerd Font.
- Nerd profile glyphs do not shift columns or clip narrow layouts.
- Help, route hints, README, and screenshots match the implemented keybindings and icon requirements.

## Non-Goals

- Rendering Jira SVG icons directly in the terminal.
- Detecting the user's installed terminal font.
- Replacing labels with icon-only controls.
- Changing Jira issue-type IDs, hierarchy metadata, status semantics, or write payloads.
- Adding animation before static input, width, and fallback behavior are correct.
