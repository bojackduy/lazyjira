# lazyjira-rs

`lazyjira-rs` is a planned fast, keyboard-first Jira TUI for daily issue work. The intended feel is the `lazy*` ecosystem: stable panes, single-key commands, vim-style navigation, visible context, and immediate feedback.

This repository currently keeps two reference implementations as submodules:

- `lazyjira/`: Go/Bubble Tea implementation with strong lazy-style layout, keymap, panels, and command flow.
- `jiratui/`: Python/Textual implementation with broad Jira feature coverage, dynamic widgets, metadata-driven forms, and async workers.

The implementation should learn from both, but the new product direction is not to copy either project directly. The target is a focused Rust TUI that makes common Jira actions faster than the browser.

## Product Goal

Make daily Jira work fast from the terminal:

- Browse issue queues and saved JQL tabs.
- Read issue summary, description, comments, links, subtasks, and metadata without losing context.
- Update status, assignee, priority, labels, summary, description, and comments with one or two keystrokes.
- Keep destructive or high-impact writes behind confirmation.
- Preserve lazy/vim muscle memory so users do not need to relearn navigation.

Non-goal: recreate every Jira screen in a terminal. The TUI should optimize the high-frequency Jira loop: find issue, inspect, update, comment, move on.

## Reference Findings

### From `lazyjira/`

- The cleanest interaction model is `key -> action -> focused handler -> state/API command -> render`.
- `pkg/tui/keymap.go` separates actions from physical keys and supports config overrides.
- `pkg/tui/handlers_keys.go` dispatches global keys first, then focus/tab/issue-specific actions.
- `pkg/tui/views` keeps rendering separate from Jira API access.
- `pkg/tui/layout.go` uses a stable side-by-side layout, then switches to a stacked accordion layout for narrow terminals.
- `pkg/jira/client.go` maps Jira REST responses into app models before state/rendering code sees them.
- The `?` help popup and bottom help bar are essential; they should be generated from the active keymap, not manually duplicated.

### From `jiratui/`

- The `APIController` pattern is useful: API methods return a normalized success/error response instead of leaking raw HTTP errors into widgets.
- Search, issue details, comments, attachments, links, subtasks, and dynamic create/edit metadata are all separate widget concerns.
- Selection changes should fetch details asynchronously and cancel stale in-flight requests; Textual does this with `run_worker(..., exclusive=True)`.
- Jira create/edit metadata should drive forms instead of hardcoding every custom field.
- User-facing errors should be concrete: connection failure, invalid response, missing metadata, no valid transition, permission failure.

### What We Will Change

- Keep `j` and `k` for navigation everywhere. `jiratui` uses some letters as direct focus shortcuts; this conflicts with lazy/vim muscle memory.
- Use `/` for search/filter/JQL entry so `s` can remain the mnemonic status/transition action.
- Keep widgets dumb: they render state and emit commands. Jira API calls should live in the API/task layer, not panel rendering code.
- Prefer fewer always-visible filters than `jiratui`; make search powerful but avoid crowding the main screen.

## Target Architecture

Planned Rust stack:

- TUI/rendering: `ratatui` with `crossterm`.
- Async/runtime: `tokio`.
- HTTP: `reqwest`.
- Data: `serde`, `serde_json`, optional `serde_yaml` for config.
- Config paths: XDG-compatible config/cache locations.

Core layers:

```text
terminal input
  -> keymap resolver
  -> command dispatcher
  -> app state reducer
  -> async Jira task queue
  -> normalized domain models/cache
  -> ratatui render pass
```

Suggested modules:

- `api`: Jira Cloud/Data Center REST client, auth, pagination, rate-limit/error mapping.
- `models`: normalized `Issue`, `Project`, `User`, `Transition`, `Comment`, `Field`, `IssueLink`, `Attachment` types.
- `state`: selected project/filter/tab/issue, caches, loading flags, pending operation, modal state.
- `commands`: user intents such as `Refresh`, `OpenIssue`, `TransitionIssue`, `AssignIssue`, `AddComment`.
- `keymap`: action enum, default bindings, user overrides, help generation.
- `tasks`: async effects that call `api` and return typed messages back to state.
- `ui`: pane rendering only; no Jira HTTP calls.
- `config`: auth/config loading, validation, and persistence.

## Data To UI Flow

### Startup

1. Load config and auth from XDG paths.
2. Build Jira client for Cloud or Data Center.
3. Fetch current user, configured projects, saved filters/JQL tabs, and initial issue list.
4. Store results in state caches.
5. Render the default layout with visible selected project/filter/status.

### Issue List

1. User chooses a tab, project, saved filter, or enters `/` search/JQL.
2. Command dispatcher emits `LoadIssues { query, start_at, page_size }`.
3. API task calls Jira search and requests only fields needed for the list plus prefetch fields.
4. Response is normalized into `IssueSummary` rows.
5. State updates list rows, total count, pagination cursor, and loading/error flags.
6. UI rerenders the issues pane with stable cursor and scroll offset.

### Issue Detail

1. Cursor movement updates selected issue immediately.
2. Selection schedules a debounced detail fetch for the selected issue key.
3. Stale detail fetches are cancelled or ignored if the selected issue changed.
4. API task fetches description, comments, links, subtasks, attachments, changelog, and editable fields as needed.
5. State updates `IssueDetail` cache and marks the selected issue as loaded.
6. Detail/info panes rerender without moving the list cursor.

### Jira Writes

1. User presses an action key such as `s`, `a`, `p`, `e`, or `c`.
2. App opens a modal, picker, editor, or confirmation flow.
3. For high-impact writes, show the exact issue key and target change before submit.
4. API task performs the write.
5. On success, patch local cache when safe or refetch the issue/list when Jira may recalculate fields.
6. On failure, keep the user in context and show the actionable Jira/API error in the status/help area.

## UI Model

Default wide layout:

```text
┌ Status / Context ───────┐┌ Issue Detail ─────────────────────────────┐
│ account, host, project  ││ summary, status, assignee, priority       │
├ Issue Tabs / Queue ─────┤│ description / comments / links / history  │
│ selected issue list     ││                                            │
├ Info / Fields ──────────┤├ Activity / Logs ──────────────────────────┤
│ selected issue metadata ││ pending API calls, errors, recent actions │
├ Projects / Filters ─────┤└────────────────────────────────────────────┘
│ projects, saved views   │
└─────────────────────────┘
? help  / search  r refresh  s status  e edit  c comment
```

Narrow layout:

- Stack panes vertically.
- Keep non-focused panes collapsed to one-line context bars.
- Always preserve selected issue, active tab, loading state, and latest error.
- Never render broken tables wider than the terminal; truncate fields with clear ellipses.

Primary panes:

- Status: current account, host, project, online/offline/error state.
- Issues: tabs for saved JQL queues, search results, hierarchy views, and recent issues.
- Info: compact selected issue fields such as key, type, status, assignee, reporter, sprint, labels.
- Detail: description, comments, links, subtasks, attachments, history.
- Projects/Filters: project list and saved views.
- Help/Status Bar: context-aware key hints generated from the current keymap.

## Keybinding Policy

Default bindings should follow lazy/vim muscle memory before app-specific shortcuts.

| Area | Keys | Action |
|---|---|---|
| Global | `?` | Open searchable help |
| Global | `q` | Back, close, or quit depending on context |
| Global | `Esc` | Cancel modal/filter or move back |
| Global | `/` | Search/filter/JQL entry |
| Global | `r` / `R` | Refresh current view / refresh all |
| Navigation | `j` / `k` | Move down / up |
| Navigation | `h` / `l` | Focus left / right or go back / open |
| Navigation | arrows | Same as vim navigation where practical |
| Navigation | `Tab` / `Shift-Tab` | Cycle focus |
| Navigation | `g` / `G` | Top / bottom |
| Navigation | `Ctrl-u` / `Ctrl-d` | Half page up / down |
| Selection | `Enter` | Open/confirm |
| Selection | `Space` | Select/toggle |
| Jira | `s` | Status/transition |
| Jira | `e` | Edit focused field |
| Jira | `a` | Assign |
| Jira | `p` | Priority |
| Jira | `c` | Comment |
| Jira | `o` | Open issue in browser |
| Jira | `y` | Copy issue URL/key |

New shortcuts must be mnemonic, documented in `?`, and configurable when practical.

## MVP Plan

### 1. Read-Only TUI Foundation

- Config/auth loading.
- Jira client with Cloud and Data Center path differences isolated.
- Basic issue search by JQL/project.
- Stable two-column layout plus narrow stacked layout.
- Issue list, selected issue context, detail pane, and help bar.
- Keyboard navigation and searchable `?` help.

### 2. Fast Daily Browsing

- Saved JQL tabs and recent issues.
- Detail prefetch on selection with stale-response protection.
- Comments, links, subtasks, attachments, and history tabs.
- Local cache for issue summaries/details with explicit refresh.
- Actionable error display in the status panel.

### 3. Safe Jira Writes

- Status transitions via `s` with a transition picker.
- Assign via `a` with user search.
- Priority via `p`.
- Comment add/edit via `c`/`e`.
- Summary/description edit through `$EDITOR` or inline modal.
- Dry-run/read-only mode that exercises the full flow without writing to Jira.

### 4. Metadata-Driven Forms

- Create issue using Jira create metadata.
- Edit custom fields using field metadata and allowed values.
- Validate required fields before submit.
- Show unsupported fields clearly instead of silently dropping them.

## Engineering Rules

- Rendering code never calls Jira directly.
- Keybindings resolve to commands, not widget-specific side effects.
- API tasks return typed messages with normalized success/error data.
- State updates should be testable without a terminal.
- Render tests should cover narrow terminals, focused panels, truncation, help hints, and empty/error states.
- Write operations must test success, Jira validation errors, network errors, and read-only/dry-run behavior.

## Open Decisions

- Exact Rust crate layout and binary name.
- Whether JQL search is a modal, a temporary tab, or both.
- Whether mouse support is included in MVP or deferred.
- How much Jira Agile support belongs in the first release: boards, sprints, epics, and backlog may require separate API handling.
