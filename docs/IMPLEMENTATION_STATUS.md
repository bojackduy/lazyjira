# Implementation Status

This is the living implementation ledger for `lazyjira`. Update it whenever a milestone changes state so current work and the next safe step are visible without reconstructing prior conversations.

Status legend: `[x]` complete, `[~]` in progress, `[ ]` planned, `[!]` blocked.

## Product Baseline

- [x] Overview-first OpenTUI shell with Active Sprint, Backlog, Kanban, Workspace, Config, inspector, and detail routes.
- [x] Keyboard-first navigation, staged issue/config edits, local rendering, discard flow, and help/keymap behavior.
- [x] Dev runtime remains fixture-backed and credential-free.
- [x] Prod runtime has local auth configuration and saved project/board workspaces.
- [x] Local-first `P` workspace switcher; remote project discovery only begins after explicit `a`.

## Jira Read Integration

- [x] Jira client foundation, error mapping, project discovery, and board discovery.
- [x] Board configuration, status-column normalization, active/future sprint discovery, and Jira field-ID discovery for sprint/points/rank.
- [x] Active sprint issue loading and bounded backlog loading.
- [x] Explicit load-more for backlog, future sprint, Kanban board, and remote search pages.
- [x] Issue detail and comments loading with stale-response protection.
- [x] Explicit `S` remote Jira search with pagination; `/` remains loaded-data filtering only and applies on Enter.
- [x] Saved prod workspace renders the shell before its Jira request starts.
- [x] Initial workspace loading/failure panel with `r` retry and stale-startup-response protection.
- [x] Current-workspace refresh and switch-failure safety (A4.1/A4.2).

## Jira Write Safety

- [x] Local staged drafts for field edits, delete requests, config edits, and draft issue creation.
- [x] `W` operation review displays planned and blocked Jira operations without mutating Jira.
- [x] Planner supports safe field-update previews for summary, priority, parent, due date, labels, components, and versions.
- [x] Planner visibly blocks unsupported or high-risk rows: transitions, users, sprint moves, custom fields, type, description, links, create, delete, and config writes.
- [x] Staged comment composer (`c`) and backlog rank staging (`J/K`) with exact Jira operation previews.
- [ ] Execute remote writes safely (A7.5): comments first, simple field updates second, then transitions/assignee/moves/rank/create; delete last and only with explicit approval.

## Completed Milestone: A4 Refresh Safety

- [x] Add a current-workspace refresh command using the existing Jira workspace loader.
- [x] Keep the last successful board visible during refresh.
- [x] Show an in-shell refreshing status without replacing loaded routes.
- [x] On refresh failure, retain the previous board and show an actionable error/retry.
- [x] On a failed workspace switch, retain the previously active workspace without relabeling it.
- [x] Add tests for refresh success, refresh failure, failed switch, and rapid workspace changes.

## Next Milestones

- [ ] Start A7.5 with comment-only Jira writes and partial-failure retention.
- [ ] Add A8 real-Jira smoke checklist using a non-production project.
- [ ] Complete Wave 3: render, narrow-terminal, loading, empty, and error-state coverage.

## Verification Standard

Every completed milestone must include targeted state/UI tests, `bun run typecheck`, `bun test`, `git diff --check`, and documentation updates here and in `docs/TASK_TRACKER.md`.

## Known Constraints

- Jira API access stays in source/loader/state code, never route or widget rendering.
- Prod does not fall back to fixture tickets.
- Remote writes remain review-only until explicitly enabled by A7.5.
- Future sprints with large issue counts are not eagerly loaded.
- Workspace changes with staged edits are blocked until the user discards or finishes that work.
