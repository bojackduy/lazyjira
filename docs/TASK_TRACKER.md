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
- [x] A7.6 Per-issue transition execution with apply-time transition-ID discovery.
- [x] A7.7 Sprint/backlog move execution through loaded sprint ID/name resolution.
- [x] A7.8 Discovered story-point and estimate execution. Tenant-specific fields without mappings remain intentionally blocked.
- [x] A7.9 Issue-type execution through per-issue edit metadata.
- [x] A7.10 Additive Jira issue-link execution using the available `Relates` link type. Link removal remains intentionally blocked until link IDs are retained.
- [x] A7.11 Issue creation through project create metadata and Jira issue-type IDs.
- [x] A7.12 Remote delete with a second destructive confirmation.
- [x] A7.13 Apply lock and outcome reporting. Non-production smoke checklist is documented separately.
- [ ] A8 Documentation updates and real Jira smoke checklist.

## Wave 3

- [ ] `08-quality-integration`: render/keymap/state tests.
- [ ] Add narrow-terminal snapshots or manual fixtures.
- [ ] Add loading/empty/error state coverage.
- [ ] Add final manual smoke checklist.

## Wave 4: Rich Jira Text

Scope and architecture: `docs/RICH_TEXT_EPIC.md`.

- [~] `R1` Add the shared Jira ADF-to-Markdown mapper with supported-node coverage and unsupported fallback metadata.
- [~] `R2` Add the Markdown-to-ADF writer and replace duplicated plain-text builders for descriptions, comments, and issue creation.
- [~] `R3` Carry rich-text safe-write metadata through normalization, drafts, write planning, apply, and reload.
- [~] `R4` Add shared OpenTUI Markdown rendering for descriptions, comments, and readable rich fields.
- [~] `R5` Add rich dev fixtures, conversion/API/render tests, narrow-terminal checks, and Jira smoke steps.

## Wave 5: Jira-Style Project Navigation

Scope and design: `docs/JIRA_PROJECT_NAVIGATION_EPIC.md`.

### N1: Route And Sidebar Foundation

- [x] `N1.1` Add route scope metadata for global, project, internal, and settings destinations.
- [x] `N1.2` Add board capabilities that resolve Scrum to Active sprints and Kanban to Board.
- [x] `N1.3` Split the sidebar into Global, Project, Quick Filters, and Pending sections without changing its terminal-first layout.
- [x] `N1.4` Add Timeline, Backlog, List, and board-aware board entries in Jira order.
- [x] `N1.5` Remove Config from primary project destinations while retaining command-palette access.
- [x] `N1.6` Migrate persisted `active-sprint` and `kanban` route values safely to the unified board destination.
- [x] `N1.7` Rebind numeric navigation to `1` Workspace, `2` Timeline, `3` Backlog, `4` List, `5` Active sprints/Board.
- [x] `N1.8` Keep `;`/`:` for command palette, restore `p` to issue Priority, and update context help, footer hints, and route labels from shared command metadata.
- [x] `N1.9` Add route/sidebar tests for Scrum, Kanban, legacy persistence, quick-filter indexing, and selection preservation.

### N2: Existing Board And Backlog Alignment

- [x] `N2.1` Unify Active Sprint and Kanban route composition behind one board route without merging their API loading policies.
- [x] `N2.2` Preserve Scrum active sprint goal, dates, complete active-sprint loading, board navigation, grouping, and draft creation.
- [x] `N2.3` Preserve Kanban bounded board paging, load-more, grouping, board navigation, and draft creation.
- [x] `N2.4` Make Backlog sprint-aware for Scrum and non-sprint-aware for Kanban.
- [x] `N2.5` Add collapse/expand behavior for backlog groups while keeping empty planning groups focusable.
- [x] `N2.6` Preserve `J/K` rank staging, move picker behavior, parent badges, inspector integration, and safe writes.
- [x] `N2.7` Add board/backlog regression tests for wide, narrow, empty, loading, partial, and error states.

### N3: Project List Data And Surface

- [x] `N3.1` Add `project-list` as an independent issue page source with selection and horizontal-scroll state.
- [x] `N3.2` Add escaped project JQL generation with Rank ordering and `updated DESC, key DESC` fallback.
- [x] `N3.3` Load Project List pages through `GET /rest/api/3/search/jql` using Jira's cursor and bounded `maxResults`.
- [x] `N3.4` Request and normalize List fields: key, summary, type, status, assignee, priority, parent, due date, sprint, points, and updated.
- [x] `N3.5` Append/dedupe pages without losing staged overlays, selection, local filters, or prior successful pages on failure.
- [x] `N3.6` Add the dense List table and shared inspector/detail integration.
- [x] `N3.7` Implement List `j/k`, `g/G`, `Ctrl-u/d`, `h/l`, `Enter`, `/`, `S`, `L`, `r`, and `n` commands.
- [x] `N3.8` Add responsive column degradation that never hides Key or Summary.
- [x] `N3.9` Add API/state/render tests for initial load, append, dedupe, refresh, partial counts, empty, permission, failure, and narrow terminals.

### N4: Timeline Data Model

- [x] `N4.1` Discover a tenant Start date field through Jira field metadata without hardcoded custom field IDs.
- [x] `N4.2` Add `startDate` normalization and preserve Jira Due date and parent key/title/type metadata.
- [x] `N4.3` Reuse the `project-list` issue cache as Timeline's base data without sharing view selection/scroll state.
- [x] `N4.4` Batch hydrate missing parents with escaped `key IN (...)` JQL; prohibit per-row N+1 parent calls.
- [x] `N4.5` Build hierarchy selectors with stable ordering, arbitrary depth, missing-parent grouping, and cycle protection.
- [x] `N4.6` Classify rows as scheduled, one-date, unscheduled, missing-parent, or invalid-hierarchy without inventing dates.
- [x] `N4.7` Add dev fixtures for team-managed hierarchy levels, missing parents, cycles, partial pages, and date combinations.
- [x] `N4.8` Add normalization, JQL, hierarchy, date-window, cycle, and partial-completeness tests.

### N5: Timeline Surface

- [x] `N5.1` Add Timeline route composition with project context, loaded/total completeness, zoom, and date-window header.
- [x] `N5.2` Render colored parent disclosure rows, indented descendants, schedule bars, milestones, and explicit unscheduled rows.
- [x] `N5.3` Add collapse state that hides descendants without changing the underlying issue cache.
- [x] `N5.4` Implement Timeline `j/k`, `g/G`, `Ctrl-u/d`, `h/l`, `[`/`]`, `Space`, `z`, `t`, `L`, `Enter`, and issue action commands.
- [x] `N5.5` Preserve selected row and date window across project-view switches in the same workspace.
- [x] `N5.6` Add the narrow textual-date layout and avoid clipped or misleading schedule bars.
- [x] `N5.7` Add scheduled, one-date, unscheduled, partial, missing-field, missing-parent, cycle, empty, loading, error, and narrow render tests.

### N6: Rollout, Documentation, And Smoke Checks

- [ ] `N6.1` Remove retired route aliases only after persisted-route migration tests pass.
- [ ] `N6.2` Update README screenshots/examples and user-facing descriptions to the Jira-style sidebar model.
- [ ] `N6.3` Update Scope Roadmap, Implementation Status, API plan, command help, and footer documentation.
- [ ] `N6.4` Add a Scrum smoke checklist covering Timeline, Backlog, List, Active sprints, detail return, filters, paging, and staged writes.
- [ ] `N6.5` Add a Kanban smoke checklist covering Timeline, Backlog, List, Board, detail return, filters, paging, and staged writes.
- [ ] `N6.6` Run `bun run typecheck`, full `bun test`, `git diff --check`, narrow-terminal smoke, and non-production Jira smoke.

## Cross-Track Reviews

- [ ] All screens use the shared domain/state model.
- [ ] New tasks link to the relevant scope in `docs/SCOPE_ROADMAP.md`.
- [ ] Commands are named and discoverable.
- [ ] `?` and command palette show current shortcuts.
- [ ] `j/k`, `h/l`, `g/G`, `Ctrl-u/d`, `/`, `q`, `Esc`, `Tab`, `Enter` behave consistently.
- [ ] No Jira API call is made inside rendering components.
- [ ] README product direction is still accurate.
- [ ] AGENTS engineering policy is still accurate.
