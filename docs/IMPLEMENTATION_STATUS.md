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
- [x] `W` operation review executes planned comments, mapped standard field updates, and backlog rank operations.
- [x] Planner supports safe field-update previews for summary, priority, parent, due date, labels, components, versions, and ADF descriptions.
- [x] Assignee uses Jira's issue-aware assignable-user picker; Reporter uses direct and group-inherited project-role members. Both stage Jira account IDs, never free text.
- [x] User pickers use Up/Down selection, preserve all filter text keys, debounce Assignee lookups, and filter cached Reporter members locally.
- [x] Planner visibly blocks unsupported or high-risk rows: transitions, sprint moves, custom fields, type, links, create, delete, and config writes.
- [x] Staged comment composer (`c`) and backlog rank staging (`J/K`) with exact Jira operation previews.
- [~] A7.5 executes comments, standard field updates, and rank moves sequentially; it clears only successful staged rows, retains failures, and refreshes affected issues.

## Completed Milestone: A4 Refresh Safety

- [x] Add a current-workspace refresh command using the existing Jira workspace loader.
- [x] Keep the last successful board visible during refresh.
- [x] Show an in-shell refreshing status without replacing loaded routes.
- [x] On refresh failure, retain the previous board and show an actionable error/retry.
- [x] On a failed workspace switch, retain the previously active workspace without relabeling it.
- [x] Add tests for refresh success, refresh failure, failed switch, and rapid workspace changes.

## Next Milestones

- [~] A7.6 Transition execution resolves the valid Jira transition at apply time; per-issue status-picker options remain pending.
- [ ] A7.7 Sprint/backlog move execution.
- [ ] A7.8 Custom-field and issue-type metadata resolution.
- [ ] A7.10 Issue links and A7.11 issue creation.
- [ ] A7.12 Remote delete with an additional explicit confirmation.
- [ ] A7.13 Apply lock and non-production Jira smoke checklist.
- [ ] Add A8 real-Jira smoke checklist using a non-production project.
- [ ] Complete Wave 3: render, narrow-terminal, loading, empty, and error-state coverage.

## Verification Standard

Every completed milestone must include targeted state/UI tests, `bun run typecheck`, `bun test`, `git diff --check`, and documentation updates here and in `docs/TASK_TRACKER.md`.

## Known Constraints

- Jira API access stays in source/loader/state code, never route or widget rendering.
- Prod does not fall back to fixture tickets.
- Only staged comments, mapped standard field updates, and rank moves execute remotely; all other Jira writes remain review-only.
- Future sprints with large issue counts are not eagerly loaded.
- Workspace changes with staged edits are blocked until the user discards or finishes that work.
