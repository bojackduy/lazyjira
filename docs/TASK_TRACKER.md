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
- [ ] Wire active sprint/backlog/issue detail loading.
- [ ] Keep dev runtime independent from credentials.
- [ ] Verify Checkpoint D in `BUILD_PLAN.md`.

### Atlassian API Plan Tasks

- [x] A0 Auth, dev/prod runtime env, and discovery baseline.
- [x] A1 Client foundation and actionable error mapping.
- [x] A1.5 Local workspace switcher and remote browse mode.
- [~] A2 Board metadata loader for columns, statuses, issue types, and fields.
- [ ] A3 Active sprint, future sprint, and bounded backlog issue loading.
- [ ] A4 Local-first project selection and workspace loading integration with refresh/loading/error state.
- [ ] A5 Issue detail and comments loading with stale-response protection.
- [ ] A6 Remote search mode separate from `/` loaded filtering.
- [ ] A7 Safe write review preparation from staged changes.
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
