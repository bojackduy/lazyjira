# Task Tracker

Use this checklist to coordinate parallel subagents.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` complete, `[!]` blocked.

## Wave 0

- [x] `01-foundation-shell`: scaffold runnable app shell.
- [x] Define test/typecheck/dev commands.
- [x] Add initial app state, routes, and dev/prod runtime switch.
- [x] Verify Checkpoint A in `BUILD_PLAN.md`.

## Wave 1

- [ ] `02-domain-demo-data`: domain models and rich dev fixture.
- [ ] `03-keymap-command-system`: lazy-style commands, keymap modes, help/command palette metadata.
- [ ] `04-active-sprint-board`: active sprint board columns/cards/navigation.
- [ ] `05-backlog-screen`: backlog sections, sprint health, rank/move interactions.
- [~] `06-inspector-detail`: inspector, full detail route, staged edits, draft issue creation, rich description/comments/links.
- [ ] Verify Checkpoint B in `BUILD_PLAN.md`.
- [ ] Verify Checkpoint C in `BUILD_PLAN.md`.

## Wave 2

- [~] `07-readonly-jira-api`: read-only Jira client and normalization.
- [x] Wire project/board discovery into workspace state.
- [x] Add concrete Atlassian API integration plan in `docs/ATLASSIAN_API_INTEGRATION_PLAN.md`.
- [~] Wire active sprint/backlog/issue detail loading.
- [ ] Keep dev runtime independent from credentials.
- [ ] Verify Checkpoint D in `BUILD_PLAN.md`.

### Atlassian API Plan Tasks

- [x] A0 Auth, dev/prod runtime env, and discovery baseline.
- [x] A1 Client foundation and actionable error mapping.
- [x] A1.5 Local workspace switcher and remote browse mode.
- [~] A2 Board metadata loader for columns, statuses, issue types, and fields.
- [x] A2.1 Board configuration columns/status IDs wired.
- [~] A2.2 Issue type and custom field discovery.
- [~] A3 Active sprint, future sprint, and bounded backlog issue loading.
- [x] A3.1 Active/future sprint discovery wired.
- [x] A3.2 Active sprint issue loading wired.
- [x] A3.3 Bounded backlog issue loading.
- [x] A3.4 Future sprint issue load-more.
- [x] A4 Loader/state foundation for refresh/loading/error/stale-response handling.
- [x] A4.1 Same-workspace refresh keeps previous successful data visible on failure.
- [x] A4.2 Cross-workspace load failure cannot relabel old issues as the new workspace.
- [x] A5 Issue detail and comments loading with stale-response protection.
- [x] A5.1 Current-route `r` refresh for selected issue detail.
- [x] A5.5 Pagination/load-more API for backlog, future sprints, and board issues.
- [x] A6 Remote search mode separate from `/` loaded filtering.
- [x] A6.1 Remote search pagination append/dedupe.
- [x] A7.0 Staged write review, discard safety, and blocked-row visibility.
- [x] A7.1 Jira operation planner for field, comment, rank, create, delete, and config changes.
- [x] A7.2 Comment execution with ADF payloads and partial-success retention.
- [x] A7.3 Standard issue-field execution: summary, priority, parent, due date, labels, components, versions, and description.
- [x] A7.4 Assignee/reporter picker and account-ID execution through Jira's issue-aware assignable-user search.
- [x] A7.5 Backlog rank execution.
- [~] A7.6 Per-issue transition execution. Apply-time transition-ID discovery is wired; the status picker still needs per-issue valid options.
- [~] A7.7 Sprint/backlog move execution. Loaded sprint ID/name resolution and Agile move endpoints are wired; a dedicated target picker remains pending.
- [~] A7.8 Metadata-driven custom-field execution. Discovered story-point and estimate field IDs are wired; epic, feature, space, and blocked remain blocked pending explicit mappings.
- [~] A7.9 Issue-type execution. Per-issue edit metadata resolves Jira type IDs at apply time; the picker still needs valid-type filtering.
- [ ] A7.10 Issue-link execution.
- [x] A7.11 Issue creation through project create metadata and Jira issue-type IDs.
- [x] A7.12 Remote delete with a second destructive confirmation.
- [~] A7.13 Apply lock and outcome reporting are wired; non-production Jira smoke checks remain.
- [ ] A8 Documentation updates and real Jira smoke checklist.

## Wave 3

- [ ] `08-quality-integration`: render/keymap/state tests.
- [ ] Add narrow-terminal snapshots or manual fixtures.
- [ ] Add loading/empty/error state coverage.
- [ ] Add final manual smoke checklist.

## Cross-Track Reviews

- [ ] All screens use the shared domain/state model.
- [ ] New tasks link to the relevant scope in `docs/SCOPE_ROADMAP.md`.
- [ ] Commands are named and discoverable.
- [ ] `?` and command palette show current shortcuts.
- [ ] `j/k`, `h/l`, `g/G`, `Ctrl-u/d`, `/`, `q`, `Esc`, `Tab`, `Enter` behave consistently.
- [ ] No Jira API call is made inside rendering components.
- [ ] README product direction is still accurate.
- [ ] AGENTS engineering policy is still accurate.
