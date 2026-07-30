# Scope Roadmap

This document tells contributors where each feature area lives, what it owns, what to read before editing, and what work is next. Use it before taking a task from `TASK_TRACKER.md`.

## How To Use This Document

1. Find the scope that matches the task.
2. Read the `Read First` files before editing.
3. Respect `Out Of Scope` even if nearby code looks tempting.
4. Run the listed verification before handing off.
5. Update this file when a scope's ownership or file paths change.

## Global Rules

- Product direction lives in `README.md`.
- Execution plan lives in `docs/BUILD_PLAN.md`.
- Checklist state lives in `docs/TASK_TRACKER.md`.
- Jira API execution detail lives in `docs/ATLASSIAN_API_INTEGRATION_PLAN.md`.
- OpenTUI implementation references live in `docs/OPENTUI_REFERENCE.md`.
- UI components must not call Jira APIs directly.
- `dev` runtime must work without credentials.
- `prod` runtime must not silently fall back to fixture data.
- `/` filters already loaded issues only.
- Remote Jira search must be a separate explicit mode.
- `w` renders local staged overlays only.
- `W` is the remote write review/apply path.
- High-impact Jira writes must preserve staged changes on failure.

## Scope Index

| Scope | Current Status | Primary Owner Area |
|---|---|---|
| Product Direction | Active | `README.md`, `docs/BUILD_PLAN.md` |
| Runtime Bootstrap | Mostly wired | `src/main.tsx`, `src/runtime/*`, `src/context/providers.tsx` |
| Auth And Config | Mostly wired | `src/auth/*` |
| Workspace Source | Partially wired | `src/workspace/*` |
| Project Switcher | Needs A1.5 | `src/context/app-state.tsx`, `src/state/project-picker.ts`, `src/ui/shell.tsx` |
| Jira Client | A1 complete | `src/jira/client.ts` |
| Jira Read Loading | Not wired | future `src/jira/endpoints.ts`, `src/jira/normalize.ts`, `src/jira/loaders.ts` |
| Domain State | Active | `src/state/app-state.ts`, `src/workspace/types.ts`, `src/state/selectors.ts` |
| Dev Fixtures | Active | `src/workspace/dev/*` |
| Workspace Home | Active | `src/routes/workspace.tsx`, `src/state/workspace.ts` |
| Jira Project Navigation | Planned | `docs/JIRA_PROJECT_NAVIGATION_EPIC.md`, `src/state/routes.ts`, `src/ui/shell.tsx` |
| Boards | Active | `src/routes/active-sprint.tsx`, `src/routes/kanban.tsx`, `src/ui/board.tsx` |
| Backlog | Active | `src/routes/backlog.tsx`, `src/state/selectors.ts` |
| Project List | Planned | future `src/routes/list.tsx`, project issue paging/state |
| Timeline | Planned | future `src/routes/timeline.tsx`, hierarchy/date selectors |
| Inspector And Detail | Active | `src/ui/issue-inspector.tsx`, `src/routes/issue-detail.tsx` |
| Rich Jira Text | Planned | `docs/RICH_TEXT_EPIC.md`, future `src/jira/adf.ts`, shared rich reader |
| Staged Changes | Active | `src/state/issue-drafts.ts`, `src/state/staged-changes.ts` |
| Metadata Config | Active | `src/routes/config.tsx`, `src/state/config-drafts.ts` |
| Loaded Search | Active | `src/state/issue-search.ts`, `src/state/selectors.ts` |
| Remote Search | Not wired | future Jira search endpoint and UI mode |
| Keymap And Commands | Active | `src/app.tsx`, `src/context/keymap.tsx` |
| UI Shell And Popups | Active | `src/ui/shell.tsx`, `src/context/toast.tsx`, `src/context/dialog.tsx` |
| Jira Writes | Placeholder only | `src/state/staged-changes.ts`, future Jira write endpoints |
| Testing And Quality | Active | `src/**/*.test.ts`, `package.json` |
| Documentation | Active | `docs/*`, `README.md`, `AGENTS.md` |

## Product Direction

Goal:

- Keep the app aligned with the overview-first Jira TUI product direction.
- Protect the distinction between overview screens and deep issue detail.
- Keep keyboard-first lazy/vim behavior coherent.

Read First:

- `README.md`
- `AGENTS.md`
- `docs/BUILD_PLAN.md`
- `docs/TASK_TRACKER.md`

Main Files:

- `README.md`
- `docs/BUILD_PLAN.md`
- `docs/TASK_TRACKER.md`
- `docs/SCOPE_ROADMAP.md`

Dependencies:

- All implementation scopes depend on this scope.

Out Of Scope:

- Do not add new product surfaces only because Jira supports them.
- Do not turn the app into a Jira administration clone.
- Do not make issue detail the default landing experience unless the product direction changes.

Next Work:

- Resolve default landing screen once real Jira loading exists.
- Clarify bulk operation safety before implementing remote writes.
- Keep README examples in sync with current runtime names and keybindings.

Verification:

- Product changes should update `README.md` and this roadmap.
- Shortcut changes should be discoverable in UI help/footer and documented when user-facing.

## Runtime Bootstrap

Goal:

- Start the app in the correct runtime env.
- Wire OpenTUI renderer, keymap provider, app providers, auth config, workspace source, and initial state.

Read First:

- `src/main.tsx`
- `src/runtime/env.ts`
- `src/runtime/env.test.ts`
- `src/context/providers.tsx`
- `src/context/config.tsx`
- `src/state/initial.ts`

Main Files:

- `src/main.tsx`
- `src/runtime/env.ts`
- `src/context/providers.tsx`
- `src/context/config.tsx`
- `src/state/initial.ts`
- `package.json`

Dependencies:

- Auth And Config
- Workspace Source
- UI Shell And Popups

Out Of Scope:

- Do not fetch Jira issues directly from `main.tsx`.
- Do not put UI behavior or command handling in startup code.
- Do not make `prod` start with dev fixture issues.

Current Behavior:

- `prod` is the default runtime env.
- `dev` is explicit and fixture-backed.
- `prod` loads auth and opens onboarding if auth is missing.
- Startup loads a saved `prodWorkspace` or `devWorkspace` when present.

Next Work:

- Add startup hydration for local workspace recents/cache after A1.5 defines the shape.
- Keep startup fast by avoiding remote project discovery during initial render.
- Add a clear empty/loading state for prod when no workspace is selected.

Verification:

- `bun test src/runtime/env.test.ts`
- `bun run typecheck`
- Manual smoke: `bun run start:dev`
- Manual smoke: `bun run start` with and without Jira config.

## Auth And Config

Goal:

- Manage local Jira credentials and persistent workspace selection safely.
- Preserve prod and dev workspace selections across auth changes.

Read First:

- `src/auth/config.ts`
- `src/auth/config.test.ts`
- `src/auth/cli.ts`
- `src/main.tsx`
- `README.md` Jira Auth and Jira Project Selection sections.

Main Files:

- `src/auth/config.ts`
- `src/auth/cli.ts`
- `src/main.tsx`
- `README.md`

Dependencies:

- Runtime Bootstrap
- Project Switcher

Out Of Scope:

- Do not print API tokens.
- Do not store remote Jira discovery cache in the auth credential object.
- Do not remove legacy config parsing unless there is a migration plan.

Current Behavior:

- Config path defaults to `~/.config/lazyjira/config.json`.
- `LAZYJIRA_CONFIG` overrides config path.
- `LAZYJIRA_API_TOKEN` or `JIRA_API_TOKEN` can override only the token at runtime.
- `prodWorkspace` and `devWorkspace` are persisted separately.
- Legacy `workspace` and `demoWorkspace` are accepted when parsing config.

Next Work:

- Add persistent recent workspace lists for A1.5.
- Decide whether discovery cache belongs in the same config file or a separate cache file.
- Add helpers to add/move/remove recent workspaces without touching auth.

Verification:

- `bun test src/auth/config.test.ts`
- Manual smoke: `bun run auth:login`, `bun run auth:status`, `bun run auth:logout`.
- Verify saved config file permissions remain user-only.

## Workspace Source

Goal:

- Provide one interface for dev fixture data and prod Jira-backed data.
- Keep UI and state code independent of where workspace data came from.

Read First:

- `src/workspace/types.ts`
- `src/workspace/dev/source.ts`
- `src/workspace/dev/fixtures.ts`
- `src/workspace/prod/source.ts`
- `src/workspace/dev/source.test.ts`
- `src/workspace/prod/source.test.ts`

Main Files:

- `src/workspace/types.ts`
- `src/workspace/dev/source.ts`
- `src/workspace/dev/fixtures.ts`
- `src/workspace/prod/source.ts`

Dependencies:

- Runtime Bootstrap
- Auth And Config
- Jira Client
- Dev Fixtures
- Jira Read Loading

Out Of Scope:

- Do not let route components branch on Jira DTOs.
- Do not let prod source return dev fixture issues.
- Do not put project picker UI state inside the source implementation.

Current Behavior:

- `WorkspaceSource` exposes `fetchProjects`, `fetchBoards`, and `loadWorkspace`.
- Dev source uses fixtures and requires no auth.
- Prod source uses Jira project/board discovery but returns an empty not-wired workspace for selected boards.

Next Work:

- A1.5: support local recent workspaces before remote project discovery.
- A2/A3: replace prod not-wired workspace with real board metadata, sprint, and backlog loading.
- Add cached discovery data to source or a companion cache module after the shape is decided.

Verification:

- `bun test src/workspace/dev/source.test.ts`
- `bun test src/workspace/prod/source.test.ts`
- Full `bun test` after changing shared workspace types.

## Project Switcher

Goal:

- Make `P` a fast local workspace switcher first.
- Let users explicitly enter remote Jira project browsing only when adding a new workspace.
- Fetch/sync data only for the final selected project+board context.

Read First:

- `src/context/app-state.tsx`
- `src/state/app-state.ts`
- `src/state/project-picker.ts`
- `src/state/project-picker.test.ts`
- `src/ui/shell.tsx`
- `src/app.tsx`
- `src/workspace/types.ts`
- `docs/ATLASSIAN_API_INTEGRATION_PLAN.md`

Main Files:

- `src/state/app-state.ts`
- `src/state/project-picker.ts`
- `src/context/app-state.tsx`
- `src/ui/shell.tsx`
- `src/app.tsx`
- `src/auth/config.ts`
- `src/workspace/types.ts`
- `src/workspace/prod/source.ts`
- `src/workspace/dev/source.ts`

Dependencies:

- Auth And Config
- Workspace Source
- UI Shell And Popups
- Keymap And Commands
- Staged Changes

Out Of Scope:

- Do not fetch all remote projects when `P` opens.
- Do not fetch workspace issue data while the user is still choosing a remote project.
- Do not silently discard staged changes when switching workspaces.
- Do not make the picker own remote issue loading details.

Current Behavior:

- `P` opens a project picker.
- Picker loads projects from the current source if projects are not already in memory.
- Selecting a project fetches boards for that project.
- Selecting a board calls `source.loadWorkspace()`, persists the workspace, and applies the workspace.
- Current switch applies loaded workspace and clears local staged changes.

Target A1.5 Behavior:

- `P` opens local saved workspaces instantly.
- Local stage shows `prodWorkspace`, `devWorkspace`, and recent saved workspaces for the current env.
- `/` filters local workspaces without remote calls.
- `Enter` switches to the selected local workspace.
- `a` enters remote browse/add mode from inside the popup.
- Remote project list is fetched only after `a` or an explicit refresh in remote mode.
- Remote project selection fetches boards only for that narrowed project.
- Final board selection saves the workspace locally, adds/moves it to recents, then loads/syncs only that workspace.
- `h` or Backspace returns from remote board/project mode to local workspace mode.
- `r` refreshes the active local workspace data, not all project discovery.
- `R` in remote mode can hard-refresh project discovery if needed.

Suggested State Shape:

- `projectPicker.mode`: `local` or `remote-projects` or `remote-boards`.
- `projectPicker.localWorkspaces`: saved workspaces for the current env.
- `projectPicker.remoteProjects`: cached/fetched Jira projects for the current session.
- `projectPicker.remoteBoards`: boards for the currently selected remote project.
- `projectPicker.remoteLoading`: true only for remote discovery.
- `projectPicker.workspaceLoading`: true only while loading the final selected workspace.
- Persistent config adds `prodRecentWorkspaces` and `devRecentWorkspaces`.

Next Work:

- Add recent workspace config helpers.
- Change `openProjectPicker()` to load local workspaces only.
- Add key handling for `a`, `r`, and `R` in picker mode.
- Update picker UI copy from `one active project context` to `local workspaces first`.
- Add tests for no remote calls on `P`, remote calls only after `a`, and final workspace sync only after board selection.

Verification:

- `bun test src/state/project-picker.test.ts`
- New config tests for recent workspace persistence.
- New app-state tests or focused state unit tests for picker mode transitions.
- Manual smoke: press `P`, switch local workspace without network wait, press `a`, browse remote, select one board.

## Jira Client

Goal:

- Own low-level Jira HTTP mechanics.
- Provide request, pagination, auth header, and actionable error categories.

Read First:

- `src/jira/client.ts`
- `src/jira/client.test.ts`
- `src/auth/config.ts`
- `docs/ATLASSIAN_API_INTEGRATION_PLAN.md`

Main Files:

- `src/jira/client.ts`
- `src/jira/client.test.ts`

Dependencies:

- Auth And Config

Out Of Scope:

- Do not normalize Jira issues here.
- Do not put app state logic here.
- Do not show toast/UI messages here.

Current Behavior:

- `jiraRequest()` sends auth and JSON headers.
- `fetchJiraPages()` handles paginated Jira list responses.
- `JiraApiError` has `status`, `category`, `endpoint`, and `retryAfter`.
- Project and board discovery use pagination.

Next Work:

- Keep endpoint-specific reads in future `src/jira/endpoints.ts` once client grows.
- Add request tests when using POST/PUT for future writes.
- Add request cancellation/stale token support only if workspace loading needs it.

Verification:

- `bun test src/jira/client.test.ts`
- `bun run typecheck`

## Jira Read Loading

Goal:

- Load real Jira board metadata, sprint data, backlog data, and issue detail into the shared domain state.
- Keep prod read loading separate from UI rendering.

Read First:

- `docs/ATLASSIAN_API_INTEGRATION_PLAN.md`
- `src/workspace/prod/source.ts`
- `src/workspace/types.ts`
- `src/state/app-state.ts`
- `src/jira/client.ts`

Main Files:

- `src/workspace/prod/source.ts`
- future `src/jira/endpoints.ts`
- future `src/jira/types.ts`
- future `src/jira/normalize.ts`
- future `src/jira/loaders.ts`
- future tests beside each file.

Dependencies:

- Jira Client
- Workspace Source
- Domain State
- Project Switcher

Out Of Scope:

- Do not implement writes in read-loading tasks.
- Do not fetch every issue in the Jira site.
- Do not make `/` trigger remote search.
- Do not leak raw Jira REST shapes into route components.

Next Work:

- A2: board metadata loader for statuses, columns, issue types, and field IDs.
- A3: active sprint, future sprint, and bounded backlog issue loading.
- A6: remote search mode and remote search pagination.
- Add fixture JSON responses for normalization tests.

Verification:

- Fixture normalization tests for board config, sprints, backlog issues, detail, comments, and missing fields.
- State tests proving refresh failure preserves previous successful data.
- Manual smoke with valid Jira Cloud credentials after A3.

## Domain State

Goal:

- Define app/domain types and selectors used by all screens.
- Keep render components simple by centralizing derived issue lists, grouping, board windows, and state overlays.

Read First:

- `src/state/app-state.ts`
- `src/state/initial.ts`
- `src/state/selectors.ts`
- `src/state/selectors.test.ts`
- `src/workspace/types.ts`

Main Files:

- `src/state/app-state.ts`
- `src/state/initial.ts`
- `src/state/selectors.ts`
- `src/workspace/types.ts`

Dependencies:

- Workspace Source
- Staged Changes
- Loaded Search

Out Of Scope:

- Do not add raw Jira response types here.
- Do not put UI component state here unless it must be shared globally.
- Do not mutate base issue data to preview staged edits.

Current Behavior:

- `AppState` includes runtime env, route, auth, project picker, workspace, search, config, issue, staged, and detail fields.
- Selectors apply quick filters, loaded search, config drafts, and issue drafts.

Next Work:

- Add project switcher local/remote state for A1.5.
- Add loading/error state for workspace loading and detail loading.
- Add remote search result state only when A6 starts.

Verification:

- `bun test src/state/selectors.test.ts`
- `bun test src/state/workspace.test.ts`
- Full `bun test` after changing `AppState`.

## Dev Fixtures

Goal:

- Provide realistic local data that exercises board, backlog, inspector, detail, and config behavior without Jira credentials.

Read First:

- `src/workspace/dev/fixtures.ts`
- `src/workspace/dev/source.ts`
- `src/workspace/dev/source.test.ts`
- `src/workspace/types.ts`

Main Files:

- `src/workspace/dev/fixtures.ts`
- `src/workspace/dev/source.ts`
- `src/workspace/dev/source.test.ts`

Dependencies:

- Workspace Source
- Domain State

Out Of Scope:

- Do not use dev fixtures in prod runtime.
- Do not make fixtures depend on network or local config.
- Do not make one giant unrealistic fixture that hides edge cases.

Current Behavior:

- Dev source exposes fixture-backed projects/boards.
- `PROJ`, `MOB`, and `OPS` have separate fixture contexts.

Next Work:

- Add fixture cases for Jira read loading edge cases before implementing normalization.
- Keep board/status/issue type shapes close to expected Jira-normalized domain data.
- Add narrow and empty fixture workspaces when UI states need testing.

Verification:

- `bun test src/workspace/dev/source.test.ts`
- Route smoke in `bun run start:dev`.

## Workspace Home

Goal:

- Give users a fast command-center overview of current workspace state.
- Show jump targets, pending changes, loaded filter results, attention queues, and recent issues.

Read First:

- `src/routes/workspace.tsx`
- `src/state/workspace.ts`
- `src/state/workspace.test.ts`
- `src/context/app-state.tsx`

Main Files:

- `src/routes/workspace.tsx`
- `src/state/workspace.ts`
- `src/state/workspace.test.ts`

Dependencies:

- Domain State
- Staged Changes
- Loaded Search
- UI Shell And Popups

Out Of Scope:

- Do not fetch Jira data from the route.
- Do not make workspace home a replacement for board/backlog routes.
- Do not hide context such as selected project, board, and pending operation.

Next Work:

- Add workspace loading/error cards once real prod loading exists.
- Add local workspace switch status after A1.5.
- Improve recent issues using real updated timestamps after A3.

Verification:

- `bun test src/state/workspace.test.ts`
- Manual smoke: workspace navigation, result focus, `Enter` opens issue detail.

## Boards

Goal:

- Render active sprint and Kanban board views with stable keyboard navigation.
- Keep active sprint and Kanban as first-class routes.

Read First:

- `src/routes/active-sprint.tsx`
- `src/routes/kanban.tsx`
- `src/ui/board.tsx`
- `src/state/board-navigation.ts`
- `src/state/board-navigation.test.ts`
- `src/state/selectors.ts`

Main Files:

- `src/routes/active-sprint.tsx`
- `src/routes/kanban.tsx`
- `src/ui/board.tsx`
- `src/state/board-navigation.ts`

Dependencies:

- Domain State
- Workspace Source
- Keymap And Commands
- Inspector And Detail

Out Of Scope:

- Do not couple board rendering to Jira APIs.
- Do not add direct mouse-first interactions as the primary workflow.
- Do not break narrow terminal behavior when adding columns or swimlanes.

Next Work:

- Wire real board status windows once A2 supplies board metadata.
- Add loading/empty/error board states for prod workspaces.
- Add WIP limits/swimlanes only after basic Jira loading is stable.

Verification:

- `bun test src/state/board-navigation.test.ts`
- Manual smoke: `j/k`, `h/l`, `g` group cycle, narrow terminal board windows.

## Backlog

Goal:

- Show active/future sprint groups and backlog groups for grooming and planning.
- Support keyboard navigation before write actions are wired.

Read First:

- `src/routes/backlog.tsx`
- `src/state/selectors.ts`
- `src/state/selectors.test.ts`
- `docs/ATLASSIAN_API_INTEGRATION_PLAN.md` A3.

Main Files:

- `src/routes/backlog.tsx`
- `src/state/selectors.ts`
- future backlog move/rank command files if split later.

Dependencies:

- Domain State
- Jira Read Loading
- Keymap And Commands
- Jira Writes for future move/rank actions.

Out Of Scope:

- Do not implement remote rank/move writes until read loading and write review are ready.
- Do not load unlimited Jira backlog pages by default.
- Do not flatten backlog into a generic issue list.

Next Work:

- Add bounded backlog loading after A3.
- Add explicit `load more` for backlog pages.
- Add move/rank preview before remote writes.

Verification:

- `bun test src/state/selectors.test.ts`
- Manual smoke: backlog groups, row movement, group movement, detail open.

## Inspector And Detail

Goal:

- Let users inspect and edit issue fields without losing board/backlog context.
- Keep full detail route focused on rich issue reading and body editing.

Read First:

- `src/ui/issue-inspector.tsx`
- `src/routes/issue-detail.tsx`
- `src/state/issue-fields.ts`
- `src/state/issue-fields.test.ts`
- `src/context/app-state.tsx`

Main Files:

- `src/ui/issue-inspector.tsx`
- `src/routes/issue-detail.tsx`
- `src/state/issue-fields.ts`
- `src/context/app-state.tsx`

Dependencies:

- Domain State
- Staged Changes
- Metadata Config
- Jira Read Loading for detail fields/comments.

Out Of Scope:

- Do not write Jira directly from inspector/detail.
- Do not store editable text outside staged drafts unless the user confirms the stage path.
- Do not let detail route become the default landing screen.

Next Work:

- Add subtasks/links display from real normalized detail data.
- Keep field choices driven by current metadata/status/type definitions.

Verification:

- `bun test src/state/issue-fields.test.ts`
- Manual smoke: inspector edit, status/type choice edit, detail body edit, `Ctrl-Enter` stage, `X` discard.

## Rich Jira Text

Goal:

- Read, render, edit, stage, and safely write rich Jira ADF through one Markdown projection.
- Apply the same mapping rules to issue descriptions, comments, issue-create bodies, and future readable/editable rich text fields.

Read First:

- `docs/RICH_TEXT_EPIC.md`
- `src/jira/normalize.ts`
- `src/context/app-state.tsx`
- `src/routes/issue-detail.tsx`
- `src/ui/issue-inspector.tsx`
- `src/jira/client.ts`
- `src/workspace/prod/source.ts`

Main Files:

- Future `src/jira/adf.ts`
- `src/jira/normalize.ts`
- `src/state/app-state.ts`
- `src/context/app-state.tsx`
- `src/state/jira-write-plan.ts`
- `src/routes/issue-detail.tsx`
- `src/ui/issue-inspector.tsx`
- `src/jira/client.ts`
- `src/workspace/prod/source.ts`
- Focused mapper, payload, state, and render tests.

Dependencies:

- Jira Read Loading
- Inspector And Detail
- Staged Changes
- Jira Writes
- Testing And Quality

Out Of Scope:

- Do not flatten ADF independently in a route, widget, or write endpoint.
- Do not silently replace unsupported ADF with lossy Markdown or plain text.
- Do not make a rich-text edit bypass staged review and the existing `W` apply path.
- Do not implement attachment/media upload until its Jira API and round-trip behavior are separately scoped.

Next Work:

- Complete `R1` through `R5` in `docs/RICH_TEXT_EPIC.md` in order.
- Reuse the shared ADF builder for comments and create-issue descriptions after `R2`.
- Add a safe Jira project smoke check after conversion and payload tests are stable.

Verification:

- Follow the conversion, payload, state, render, and manual checks in `docs/RICH_TEXT_EPIC.md`.
- Run `bun run typecheck` and `bun test` for every rich-text change.

## Staged Changes

Goal:

- Keep local edits/deletes/config changes reviewable and discardable before any remote Jira write.
- Render staged overlays without mutating base loaded data.

Read First:

- `src/state/issue-drafts.ts`
- `src/state/issue-drafts.test.ts`
- `src/state/staged-changes.ts`
- `src/state/staged-changes.test.ts`
- `src/context/app-state.tsx`
- `src/ui/shell.tsx` staged discard and remote apply popups.

Main Files:

- `src/state/issue-drafts.ts`
- `src/state/staged-changes.ts`
- `src/context/app-state.tsx`
- `src/ui/shell.tsx`

Dependencies:

- Domain State
- Inspector And Detail
- Metadata Config
- Jira Writes

Out Of Scope:

- Do not clear staged changes on small `w`.
- Do not mutate base issue data just to preview a draft.
- Do not silently drop unsupported remote write operations.
- Do not switch workspaces with staged changes without confirmation once A1.5 is implemented.

Current Behavior:

- `issueWithDraft()` renders issue draft overlays.
- `stagedChanges()` lists issue edits, issue deletes, and config drafts.
- `X` opens staged discard.
- `W` opens a remote write review with planned and blocked Jira operation previews.

Next Work:

- Add workspace-switch confirmation for staged changes.
- Add staged comment/rank models before planning those write types.
- Wire low-risk write execution only after the review supports exact supported operations and failure retention.

Verification:

- `bun test src/state/issue-drafts.test.ts`
- `bun test src/state/staged-changes.test.ts`
- Manual smoke: edit, render with `w`, discard with `X`, review with `W`.

## Metadata Config

Goal:

- Inspect and locally stage board/project metadata changes without pretending to be a Jira admin console.

Read First:

- `src/routes/config.tsx`
- `src/state/config-drafts.ts`
- `src/state/config-drafts.test.ts`
- `src/context/app-state.tsx`

Main Files:

- `src/routes/config.tsx`
- `src/state/config-drafts.ts`
- `src/context/app-state.tsx`

Dependencies:

- Domain State
- Staged Changes
- Jira Read Loading for real metadata.

Out Of Scope:

- Do not implement real Jira admin metadata writes until explicitly scoped.
- Do not make read-only sections appear writable.
- Do not couple config rows to raw Jira DTOs.

Next Work:

- Populate statuses/columns/issue types from real board metadata after A2.
- Keep priorities/fields/quick filters read-only until API model is clear.
- Add more useful error/read-only messages after real metadata arrives.

Verification:

- `bun test src/state/config-drafts.test.ts`
- Manual smoke: add/rename/color/remove local metadata, render, discard.

## Loaded Search

Goal:

- Filter only issues already loaded into `state.issues`.
- Respect quick filters, staged issue drafts, and staged config names.

Read First:

- `src/state/issue-search.ts`
- `src/state/issue-search.test.ts`
- `src/state/selectors.ts`
- `src/ui/shell.tsx` search bar.
- `src/app.tsx` search key mode.

Main Files:

- `src/state/issue-search.ts`
- `src/state/selectors.ts`
- `src/ui/shell.tsx`
- `src/app.tsx`

Dependencies:

- Domain State
- Staged Changes
- Keymap And Commands

Out Of Scope:

- Do not call Jira from loaded search.
- Do not overload `/` to mean remote search.
- Do not let route/component `d/u` or normal keys steal typing while search is open.

Current Behavior:

- `/` opens loaded filter.
- `S` opens explicit remote Jira search.
- `searchOpen` makes input own normal typing keys.
- Search applies through `issueList(state)`.

Next Work:

- Add visible search syntax help if query language grows.
- Keep remote search separate under Remote Search scope.

Verification:

- `bun test src/state/issue-search.test.ts`
- Manual smoke: `/`, type query, Enter, Esc, empty Enter clears.

## Remote Search

Goal:

- Search Jira remotely with explicit user intent and bounded pagination.
- Keep remote search separate from loaded filtering.

Read First:

- `docs/ATLASSIAN_API_INTEGRATION_PLAN.md` A6.
- `src/jira/client.ts`
- `src/state/issue-search.ts`
- `src/ui/shell.tsx`

Main Files:

- `src/jira/client.ts`
- `src/workspace/prod/source.ts`
- `src/state/app-state.ts`
- `src/ui/shell.tsx`
- `src/state/workspace.ts`

Dependencies:

- Jira Client
- Jira Read Loading
- UI Shell And Popups
- Keymap And Commands

Out Of Scope:

- Do not fetch all Jira issues to support local filtering.
- Do not make remote search results affect `/` loaded filtering semantics.
- Do not run remote search on every keypress until throttling/cancellation is designed.

Next Work:

- Add richer query syntax help if remote search grows beyond simple text search.
- Consider a dedicated remote result route if workspace result cards become cramped.

Verification:

- Tests proving loaded `/` does not call Jira.
- Tests proving remote search calls only explicit search loader.

## Keymap And Commands

Goal:

- Keep lazy/vim keyboard behavior consistent across routes, dialogs, search, and edit modes.
- Prefer named commands over ad hoc component side effects.

Read First:

- `src/app.tsx`
- `src/context/keymap.tsx`
- `docs/OPENTUI_REFERENCE.md`
- `docs/subagents/03-keymap-command-system.md`
- `README.md` Navigation Model.

Main Files:

- `src/app.tsx`
- `src/context/keymap.tsx`
- route files with route-local bindings.
- `src/ui/shell.tsx` popup key handlers.

Dependencies:

- UI Shell And Popups
- Project Switcher
- Loaded Search
- Boards
- Backlog
- Inspector And Detail

Out Of Scope:

- Do not add shortcut collisions without documenting and justifying them.
- Do not let text inputs consume global commands incorrectly.
- Do not hardcode shortcut labels in many places when command metadata can own them later.

Current Behavior:

- Global bindings live mostly in `src/app.tsx`.
- Popup-specific keyboard handlers live in `src/ui/shell.tsx`.
- Some route-local page scrolling bindings exist in route files.

Next Work:

- Add proper help/dialog command metadata.
- Add project picker local/remote mode keybindings for A1.5.
- Reduce hardcoded footer shortcut strings once command metadata exists.

Verification:

- Existing key behavior manual smoke across routes.
- Add keymap tests when command registry is formalized.

## UI Shell And Popups

Goal:

- Own top-level layout, sidebar, footer, global popups, search bar, project picker, and staged dialogs.

Read First:

- `src/ui/shell.tsx`
- `src/context/theme.tsx`
- `src/context/toast.tsx`
- `src/context/dialog.tsx`
- `docs/OPENTUI_REFERENCE.md`

Main Files:

- `src/ui/shell.tsx`
- `src/context/theme.tsx`
- `src/context/toast.tsx`
- `src/context/dialog.tsx`

Dependencies:

- Domain State
- Keymap And Commands
- Project Switcher
- Loaded Search
- Staged Changes

Out Of Scope:

- Do not call Jira APIs from shell/popup rendering.
- Do not make dialogs unusable on narrow terminals.
- Do not hide actionable errors behind generic messages.

Next Work:

- Split large popup code from `shell.tsx` if it starts blocking focused work.
- Redesign project picker for local-first and remote-add modes.
- Add loading/error surfaces for workspace refresh and pagination/search work.

Verification:

- Manual smoke on wide and narrow terminals.
- Future render tests through OpenTUI `testRender` when available in test setup.

## Jira Writes

Goal:

- Convert staged local changes into safe Jira mutations after read loading is reliable.
- Show exact before/after context before applying remote writes.

Read First:

- `src/state/staged-changes.ts`
- `src/context/app-state.tsx` remote apply handlers.
- `src/ui/shell.tsx` remote apply popup.
- `docs/ATLASSIAN_API_INTEGRATION_PLAN.md` Staged Writes Plan.
- Future Jira field metadata from A2.

Main Files:

- `src/state/staged-changes.ts`
- future `src/jira/write-endpoints.ts` or `src/jira/endpoints.ts` write section.
- future write preview/operation translator.
- `src/context/app-state.tsx`
- `src/ui/shell.tsx`

Dependencies:

- Jira Client
- Jira Read Loading
- Staged Changes
- Metadata Config

Out Of Scope:

- Do not implement writes before read models and field IDs are known.
- Do not remotely delete issues until product explicitly allows it.
- Do not clear staged changes after a failed write.
- Do not silently ignore unsupported staged changes.

Next Work:

- Add write operation preview translator.
- Mark unsupported operations in review popup.
- Add transition/status write path after transitions metadata is available.

Verification:

- Unit tests for staged-change to write-preview translation.
- Mock Jira write tests for error preservation.
- Manual smoke with a safe test Jira project only after explicit approval.

## Testing And Quality

Goal:

- Keep changes verifiable with fast tests and targeted manual smoke checks.

Read First:

- `package.json`
- `docs/TASK_TRACKER.md`
- existing `src/**/*.test.ts`
- `docs/subagents/08-quality-integration.md`

Main Files:

- `src/**/*.test.ts`
- `docs/TASK_TRACKER.md`
- future manual smoke checklist.

Dependencies:

- Every implementation scope.

Out Of Scope:

- Do not skip tests for state/normalization helpers because the UI is visual.
- Do not rely only on manual TUI smoke for data normalization.
- Do not add broad brittle snapshot tests before stable layout contracts exist.

Current Commands:

- `bun run typecheck`
- `bun test`
- Focused tests such as `bun test src/jira/client.test.ts`

Next Work:

- Add manual smoke checklist for prod Jira read-only loading.
- Add tests for project switcher local/remote mode before implementing A1.5.
- Add fixture-based normalization tests for A2/A3/A5.

Verification:

- Every phase report should list focused tests and full tests run.

## Documentation

Goal:

- Keep docs useful for contributors and aligned with current file paths.

Read First:

- `docs/README.md`
- `docs/BUILD_PLAN.md`
- `docs/TASK_TRACKER.md`
- `docs/ATLASSIAN_API_INTEGRATION_PLAN.md`
- `docs/SCOPE_ROADMAP.md`
- `docs/subagents/*.md`

Main Files:

- `docs/*`
- `README.md`
- `AGENTS.md`

Dependencies:

- Product Direction
- All implementation scopes.

Out Of Scope:

- Do not document behavior that is not implemented unless it is clearly labeled as planned.
- Do not leave stale file paths after moving implementation code.
- Do not duplicate detailed implementation instructions across many docs when one doc can be linked.

Next Work:

- Refresh stale subagent docs that still use old `demo` wording or old suggested `src/services/jira/*` paths.
- Add scope links from task tracker items as tasks become more granular.
- Keep phase reports short but link to changed scopes.

Verification:

- `git diff --check -- docs`
- Grep docs for stale terms after major renames, such as `demo mode` when current code says `dev runtime`.
