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
- [x] A7 Safe write review preparation from staged changes.
- [x] A7.1 Jira operation planner for fields, comments, transitions, assignee, sprint move, rank, create, and blocked unsupported rows.
- [ ] A7.5 Safe write execution rollout: comment, field update, transition, assignee, sprint move, rank, create, delete last.
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
