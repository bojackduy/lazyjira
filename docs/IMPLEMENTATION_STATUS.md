# Implementation Status

This is the living implementation ledger for `lazyjira`. Update it whenever a milestone changes state so current work and the next safe step are visible without reconstructing prior conversations.

Status legend: `[x]` complete, `[~]` in progress, `[ ]` planned, `[!]` blocked.

## Product Baseline

- [x] Overview-first OpenTUI shell with Workspace, Timeline, Backlog, List, unified board, Config, inspector, and detail routes.
- [x] Keyboard-first navigation, staged issue/config edits, local rendering, discard flow, and help/keymap behavior.
- [x] Dev runtime remains fixture-backed and credential-free.
- [x] Prod runtime has local auth configuration and saved project/board workspaces.
- [x] Local-first `P` workspace switcher; remote project discovery only begins after explicit `a`.
- [x] Wave 5 N1 Jira-style navigation foundation: scoped sidebar sections, Timeline/List route slots, unified board route, Scrum/Kanban labels, legacy route migration, numeric navigation, and palette/settings separation.

## Jira Read Integration

Current project navigation uses `Workspace`, `Timeline`, `Backlog`, `List`, and one board-aware route labeled `Active sprints` for Scrum or `Board` for Kanban. Timeline and List are implemented project-wide surfaces, not placeholders.

- [x] Jira client foundation, error mapping, project discovery, and board discovery.
- [x] Board configuration, status-column normalization, active/future sprint discovery, and Jira field-ID discovery for sprint/points/rank.
- [x] Active sprint issue loading and bounded backlog loading.
- [x] Explicit load-more for backlog, future sprint, Kanban board, and remote search pages.
- [x] Issue detail and comments loading with stale-response protection.
- [x] Explicit `S` remote Jira search with pagination; `/` remains loaded-data filtering only and applies on Enter.
- [x] Saved prod workspace renders the shell before its Jira request starts.
- [x] Initial workspace loading/failure panel with `r` retry and stale-startup-response protection.
- [x] Current-workspace refresh and switch-failure safety (A4.1/A4.2).
- [x] Kanban uses a memoized board-cell model and defaults to ungrouped rendering to avoid repeated high-cardinality grouping work on route entry.
- [x] Backlog retains empty sprint/backlog groups as focusable planning containers; `h/l` moves group focus and `L` loads the focused group when possible.

## Jira Write Safety

- [x] Local staged drafts for field edits, delete requests, config edits, and draft issue creation.
- [x] `W` operation review executes planned comments, mapped standard field updates, and backlog rank operations.
- [x] Planner supports safe field-update previews for summary, priority, parent, due date, labels, components, versions, and ADF descriptions.
- [x] Assignee and Reporter use Jira's issue-aware assignable-user picker and stage account IDs, never free text.
- [x] User pickers use Up/Down selection, preserve all filter text keys, debounce stale-safe lookups, and clear picker state on cancel.
- [x] Planner visibly blocks unsupported or high-risk rows: transitions, sprint moves, custom fields, type, links, create, delete, and config writes.
- [x] Staged comment composer (`c`) and backlog rank staging (`J/K`) with exact Jira operation previews.
- [x] A7.5 executes planned writes sequentially, clears only successful staged rows, retains failures, and refreshes affected issues.

## Completed Milestone: A4 Refresh Safety

- [x] Add a current-workspace refresh command using the existing Jira workspace loader.
- [x] Keep the last successful board visible during refresh.
- [x] Show an in-shell refreshing status without replacing loaded routes.
- [x] On refresh failure, retain the previous board and show an actionable error/retry.
- [x] On a failed workspace switch, retain the previously active workspace without relabeling it.
- [x] Add tests for refresh success, refresh failure, failed switch, and rapid workspace changes.

## Next Milestones

- [x] A7.6 Transition execution resolves a valid Jira transition at apply time.
- [x] A7.7 Sprint/backlog moves resolve loaded sprint IDs/names or backlog at apply time.
- [x] A7.8 Discovered numeric story-point and estimate fields execute through Jira field IDs; unmapped tenant fields remain explicitly blocked.
- [x] A7.9 Issue type resolves a permitted Jira type ID through per-issue edit metadata at apply time.
- [ ] A7.10 Issue links and A7.11 issue creation.
- [x] A7.12 Remote delete requires staging confirmation plus a second `W` confirmation in remote review.
- [x] A7.13 Remote apply is locked while requests are running; non-production smoke checks are documented.
- [x] A7.11 Draft creation resolves an allowed project issue type through Jira create metadata before posting.
- [ ] Add A8 real-Jira smoke checklist using a non-production project.
- [ ] Complete Wave 3: render, narrow-terminal, loading, empty, and error-state coverage.
- [~] Wave 5 Jira-style project navigation is in progress: N1-N5 are complete; N6 cleanup, docs, and Jira smoke checks remain. Scope remains in `docs/JIRA_PROJECT_NAVIGATION_EPIC.md`.

## Verification Standard

Every completed milestone must include targeted state/UI tests, `bun run typecheck`, `bun test`, `git diff --check`, and documentation updates here and in `docs/TASK_TRACKER.md`.

## Known Constraints

- Jira API access stays in source/loader/state code, never route or widget rendering.
- Prod does not fall back to fixture tickets.
- Supported staged writes include comments, mapped fields, transitions, sprint/backlog moves, rank, issue type, additive links, create, and confirmed delete; unsupported tenant fields and metadata config remain visibly blocked.
- Future sprints with large issue counts are not eagerly loaded.
- Workspace changes with staged edits are blocked until the user discards or finishes that work.
