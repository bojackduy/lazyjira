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
- [x] A2.3 Jira-native priority, issue-type icon, Issue color, Epic Color, and parent colors, plus semantic status colors with Jira category fallback.
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
- [x] A7.14 Priority editing uses issue-specific Jira allowed values with catalog fallback, stale-response protection, and no free-text staging.
- [x] A7.15 Backlog rank drafts project into local order, survive `w`, revert with discard, and materialize after successful Jira writes.
- [x] A7.16 Inspector derives Epic/Feature hierarchy values, hides raw LexoRank, and provides Jira-backed label suggestions with custom entry.
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
- [x] `N2.8` Replace fixed Backlog parent and metadata columns with measured wide, medium, and narrow row layouts that preserve complete issue keys.
- [x] `N2.9` Add balanced Backlog cards with ellipsized title boundaries, conditional top-level ancestor key/name lines, prioritized metadata, and consistent vertical separation.
- [x] `N2.10` Center the destination issue or collapsed group after Backlog `h/l` group jumps while retaining keep-visible `j/k` row navigation.
- [x] `N2.11` Size the Active sprints/Board viewport from its actual pane and track grouped navigation by full-height row wrappers so `j/k` cannot move behind clipping before `d/u` is used.

### N3: Project List Data And Surface

- [x] `N3.1` Add `project-list` as an independent issue page source with selection and horizontal-scroll state.
- [x] `N3.2` Add escaped project JQL generation with Rank ordering and `updated DESC, key DESC` fallback.
- [x] `N3.3` Load Project List pages through `GET /rest/api/3/search/jql` using Jira's cursor and bounded `maxResults`.
- [x] `N3.4` Request and normalize List fields: key, summary, type, status, assignee, priority, parent, due date, sprint, points, and updated.
- [x] `N3.5` Append/dedupe pages without losing staged overlays, selection, local filters, or prior successful pages on failure.
- [x] `N3.6` Add the dense List table and shared inspector/detail integration.
- [x] `N3.7` Implement List `j/k`, `g/G`, `Ctrl-u/d`, `h/l`, `Space`, `Enter`, `/`, `S`, `L`, `r`, and `n` commands.
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

- [x] `N6.1` Remove retired route aliases only after persisted-route migration tests pass.
- [x] `N6.2` Update README screenshots/examples and user-facing descriptions to the Jira-style sidebar model.
- [x] `N6.3` Update Scope Roadmap, Implementation Status, API plan, command help, and footer documentation.
- [x] `N6.4` Add a Scrum smoke checklist covering Timeline, Backlog, List, Active sprints, detail return, filters, paging, and staged writes.
- [x] `N6.5` Add a Kanban smoke checklist covering Timeline, Backlog, List, Board, detail return, filters, paging, and staged writes.
- [!] `N6.6` Automated typecheck/tests/diff and narrow-layout helper coverage pass; non-production Scrum/Kanban Jira smoke remains manual in `docs/JIRA_PROJECT_NAVIGATION_SMOKE_CHECKLIST.md`.

## Wave 6: Reported Jira UX Corrections

### R1: Parent Navigation And Colors

- [x] `R1.1` Color the complete parent badge.
- [x] `R1.2` Open parent with Enter from issue detail.
- [x] `R1.3` Preserve child-to-parent detail history for `q`/`Esc` return.
- [x] `R1.4` Show `enter parent` in the detail footer when available.
- [x] `R1.5` Use Jira Issue color/Epic Color for loaded parents.
- [x] `R1.6` Apply parent color to the Inspector Parent field and picker.

### R2: Jira Metadata Colors

- [x] `R2.1` Discover Jira Issue color and Epic Color dynamically.
- [x] `R2.2` Use Jira priority `statusColor`.
- [x] `R2.3` Extract issue-type color from Jira icon assets.
- [x] `R2.4` Keep generated colors only as unavailable-metadata fallback.
- [x] `R2.5` Restore semantic workflow status colors.
- [x] `R2.6` Use Jira status category only as a coarse fallback.
- [x] `R2.7` Cover HPCE Planned, QA, Review, Ready, Rejected, Reopened, Done, and ACC statuses.

### R3: Scalable Project Discovery

- [x] `R3.1` Add a typed single-page Jira project reader.
- [x] `R3.2` Load only the first 50 projects when discovery opens.
- [x] `R3.3` Add `[` previous-page and `]` next-page commands.
- [x] `R3.4` Cache visited pages by normalized query and offset.
- [x] `R3.5` Display loaded range, total projects, and page count.
- [x] `R3.6` Use Jira server-side `query` search from `/`.
- [x] `R3.7` Debounce project search and reject stale responses.
- [x] `R3.8` Preserve the previous successful page during loading/failure.
- [x] `R3.9` Add equivalent pagination behavior to the dev source.
- [x] `R3.10` Verify against the observed 1,919-project Jira organization.

### R4: Project And Board Selection

- [x] `R4.1` Rename “Add project” to “Choose Jira project.”
- [x] `R4.2` Fetch boards only after selecting a project.
- [x] `R4.3` Automatically open projects with exactly one board.
- [x] `R4.4` Show the board chooser only when multiple boards exist.
- [x] `R4.5` Display board name and Scrum/Kanban type.
- [x] `R4.6` Restore the previous page and project selection when returning from boards.
- [!] `R4.7` Zero-board project-only mode remains undecided; the picker retains a clear retryable no-board error.
- [x] `R4.8` Verify HPCE automatically selects Scrum board `8608`.

### R5: Timeline Hierarchy

- [x] `R5.1` Resolve root eligibility from Jira `hierarchyLevel`.
- [x] `R5.2` Show positive-level Feature/Epic/Initiative roots.
- [x] `R5.3` Include all loaded descendants beneath valid roots.
- [x] `R5.4` Stop rendering parentless standard issues as main roots.
- [x] `R5.5` Add a virtual `Unparented issues` section.
- [x] `R5.6` Keep the section collapsed by default.
- [x] `R5.7` Support `j/k` selection and `Space`/`Enter` expansion on the section header.
- [x] `R5.8` Place missing-parent standard branches in the unparented section.
- [x] `R5.9` Keep cyclic/invalid hierarchy warnings separate.
- [x] `R5.10` Add custom-level, filtering, pagination, collapse, and narrow-layout tests.

### R6: Issue-Type Display Names

- [x] `R6.1` Render Inspector Type through `issueTypeName()`.
- [x] `R6.2` Render type names in full issue detail.
- [x] `R6.3` Render type names in Workspace results.
- [x] `R6.4` Include normalized `typeName` in loaded issue search.
- [x] `R6.5` Keep Jira type IDs internally for edits and writes.
- [x] `R6.6` Test metadata resolution, missing-metadata fallback, staged changes, and write payload IDs.

### R7: Verification

- [x] `R7.1` Run typecheck and all tests.
- [x] `R7.2` Run production build and diff validation.
- [x] `R7.3` Smoke-test project paging and search against the large Jira organization.
- [x] `R7.4` Smoke-test HPCE single-board auto-selection.
- [x] `R7.5` Smoke-test Timeline hierarchy and the collapsed unparented section.
- [x] `R7.6` Smoke-test Inspector Type labels and Jira ID write preservation.

## Wave 7: Keyboard Integrity And Terminal Iconography

Scope and design: `docs/KEYBOARD_ICONOGRAPHY_EPIC.md`.

### K1: Input Ownership

- [x] `K1.1` Add a pure shared predicate that blocks route-local bindings while a popup, dialog, or text editor owns keyboard input.
- [x] `K1.2` Apply the predicate to Workspace, Timeline, Backlog, List, Board, Config, Detail, and Inspector local binding layers.
- [x] `K1.3` Keep command-level route/focus/modal guards as a second safety boundary.
- [x] `K1.4` Ensure onboarding retains only `Enter` continue/save and `Esc` close as non-text behavior.
- [x] `K1.5` Verify onboarding URL, email, and token fields accept `d`, `u`, `j`, `k`, `h`, `l`, and ordinary punctuation.
- [x] `K1.6` Verify typing in any editor cannot move selection or scroll the route behind it.

### K2: Timeline And List Paging

- [x] `K2.1` Bind plain `d`/`u` in Timeline and retain `Ctrl-d`/`Ctrl-u` aliases.
- [x] `K2.2` Bind plain `d`/`u` in List and retain `Ctrl-d`/`Ctrl-u` aliases.
- [x] `K2.3` Move selection by half the visible viewport rather than scrolling independently.
- [x] `K2.4` Bring the destination row into view after every page move.
- [x] `K2.5` Include Timeline issue rows, the Unparented issues section, and the create row in bounded paging.
- [x] `K2.6` Preserve List hierarchy collapse and Timeline section/branch collapse while paging.
- [x] `K2.7` Update route hints, help metadata, and README navigation documentation.
- [x] `K2.8` Add wide/narrow input-driven tests for plain keys, Ctrl aliases, boundaries, and selected-row visibility.

### I1: Icon Foundation

- [x] `I1.1` Add a central semantic icon catalog with `nerd`, `unicode`, and `ascii` profiles.
- [x] `I1.2` Add `LAZYJIRA_ICON_MODE` parsing with `unicode` default and safe invalid-value fallback.
- [x] `I1.3` Expose icons through one shared context or selector boundary instead of importing profile glyphs into components.
- [x] `I1.4` Define separate selection, collapsed, expanded, leaf, create, missing-parent, and invalid-hierarchy tokens.
- [x] `I1.5` Verify every structural glyph occupies one terminal cell in supported profiles.
- [x] `I1.6` Add profile-selection, fallback, and width-contract tests.
- [x] `I1.7` Add command-palette preview and live Nerd, Unicode, and ASCII profile selection.
- [x] `I1.8` Persist the selected safe profile in the lazyjira config while keeping `LAZYJIRA_ICON_MODE` as the highest-precedence override.
- [x] `I1.9` Add live-switch, persistence, override, and picker render/input tests.

### I2: Structural Icon Rollout

- [x] `I2.1` Replace ambiguous Timeline selection/disclosure markers with separate semantic icons.
- [x] `I2.2` Replace ambiguous List selection/disclosure markers with separate semantic icons.
- [x] `I2.3` Apply disclosure icons to Backlog groups without changing collapse behavior.
- [x] `I2.4` Apply create icons to Board, Timeline, and other create rows while retaining text labels.
- [x] `I2.5` Preserve distinct missing-parent and invalid-hierarchy indicators.
- [x] `I2.6` Add wide and narrow render coverage for all structural states and icon profiles.

### I3: Jira Metadata Icons

- [x] `I3.1` Add issue-type icon resolution by exact normalized common name.
- [x] `I3.2` Add subtask, positive hierarchy-level, custom-type, and unknown-type fallbacks.
- [x] `I3.3` Apply issue-type icons to Board, Backlog, List, Workspace, Detail, Inspector, and metadata legends.
- [x] `I3.4` Add semantic status icons without replacing existing status labels or colors.
- [x] `I3.5` Add semantic priority icons without replacing Jira priority labels or colors.
- [x] `I3.6` Add restrained parent, blocked, stale, and unassigned indicators.
- [x] `I3.7` Verify staged type edits and Jira write payloads continue using canonical type IDs.
- [x] `I3.8` Align Nerd Story, Epic, Task, Sub-task, and Bug glyphs with Jira's visual language while retaining portable profile fallbacks.

### I4: Navigation, Actions, And Rollout

- [x] `I4.1` Add semantic icons to Workspace, Timeline, Backlog, List, Active sprints/Board, and Config destinations.
- [x] `I4.2` Add action icons to create, refresh, search, warning, error, staged, and apply surfaces where they improve scanning.
- [x] `I4.3` Keep destructive confirmations and actionable Jira errors text-complete without relying on icons.
- [x] `I4.4` Verify Unicode and ASCII modes on terminals without Nerd Font support.
- [!] `I4.5` Automated Nerd profile width/render tests and dev startup pass; physical patched-font appearance remains a manual check.
- [~] `I4.6` README installation notes, help, and render examples are updated; refresh the product screenshot after visual approval.
- [~] `I4.7` Typecheck, 285 tests, production build, diff validation, and dev navigation smoke pass; physical wide/narrow Nerd Font smoke remains manual.

## Cross-Track Reviews

- [ ] All screens use the shared domain/state model.
- [ ] New tasks link to the relevant scope in `docs/SCOPE_ROADMAP.md`.
- [ ] Commands are named and discoverable.
- [ ] `?` and command palette show current shortcuts.
- [ ] `j/k`, `h/l`, `g/G`, `Ctrl-u/d`, `/`, `q`, `Esc`, `Tab`, `Enter` behave consistently.
- [ ] No Jira API call is made inside rendering components.
- [ ] README product direction is still accurate.
- [ ] AGENTS engineering policy is still accurate.
