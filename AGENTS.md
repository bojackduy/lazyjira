# AGENTS.md

## Product Direction

We are building a fast, keyboard-first Jira workspace in the `lazy*` tool family. The app should preserve lazy/vim muscle memory while giving Jira-specific overview screens the space they deserve: active sprint, backlog, Kanban board, project/board navigation, issue inspector, and rich issue/document detail.

The goal is not a simple ticket browser. The goal is to make daily Jira work fast: understand sprint/backlog state at a glance, track work across columns, groom and rank backlog items, triage blocked/stale/unassigned work, open rich issue details when needed, update Jira safely, and jump back to work with minimal friction.

## Reference Projects

- `lazyjira/` and `jiratui/` are reference implementations and inspiration sources unless a task explicitly asks to modify them.
- New implementation work should live in the project area intended for this repo, not mixed into reference code without a reason.
- Preserve useful ideas from existing tools, but do not copy behavior blindly when Jira needs a different flow.

## UX Policy

- Optimize for overview first, details second.
- Treat Timeline, Backlog, List, and the board-aware Active sprints/Board destination as first-class project screens.
- Prioritize keyboard workflows over mouse workflows.
- Keep the UI stable: panels should not jump around unless terminal size requires it.
- Prefer one or two keystrokes for common actions once focus is in the right pane.
- Make context visible: selected project, board, sprint/backlog section, issue, status, and pending operation should be clear.
- Default to safe browsing. Destructive or high-impact writes need confirmation.
- Show actionable Jira/API errors instead of swallowing them or replacing them with vague messages.
- Support narrow terminals by stacking or simplifying panes rather than rendering broken layouts.
- Use `?` as the source of truth for discoverable keybindings.

## Keybinding Policy

Follow lazy/vim muscle memory before inventing new shortcuts.

- Global: `?` help, `q` back/quit, `Esc` cancel/close, `/` search/filter, `r` refresh.
- Navigation: `h`/`j`/`k`/`l` and arrow keys, `Tab`/`Shift-Tab` to change focus, `g`/`G` for top/bottom, `Ctrl-u`/`Ctrl-d` for page scroll.
- Selection: `Enter` open/confirm, `Space` select/toggle.
- Jira actions: `e` edit, `a` assign, `s` status/transition, `c` comment, `p` priority, `o` open in browser.
- New shortcuts must be mnemonic, documented in help, and configurable when practical.
- Avoid shortcut collisions with established lazy-style meanings unless the task explicitly changes the model.

## Engineering Policy

- Before implementation work, read `README.md`, `docs/BUILD_PLAN.md`, `docs/TASK_TRACKER.md`, and `docs/OPENTUI_REFERENCE.md`.
- Keep interactions command-driven: keybindings call commands, commands update state, and the UI renders state.
- Keep Jira API access out of widget/rendering code.
- Separate API, cache/state, keymap, command handling, and rendering concerns.
- Prefer small, testable units around keymap resolution, command behavior, API adaptation, and state transitions.
- When adding a Jira write operation, include the read-only/dry-run behavior and the failure feedback path.
- Update user-facing docs and in-app keybinding help whenever behavior or shortcuts change.
