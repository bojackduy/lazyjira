# Atlassian API Integration Plan

## Goal

Wire real Atlassian Jira data into the existing overview-first TUI without changing the UI contract that already works with demo data.

Success means a configured user can choose a Jira-backed project/board in `prod`, choose a fixture-backed project/board in `dev`, explicitly refresh real active sprint/backlog/detail data, filter the loaded data locally with `/`, and keep staged writes reviewable before any remote mutation is attempted.

## Current Baseline

- Auth/config exists in `src/auth/config.ts` and supports one Jira site, email, API token, selected prod workspace, and selected dev workspace.
- Project/board discovery exists in `src/jira/client.ts` with `fetchAccessibleProjects()` and `fetchProjectBoards()`, and is consumed by `src/workspace/prod/source.ts`.
- Runtime env exists in `src/runtime/env.ts`: normal startup defaults to `prod`; `dev` opts into fixture-backed workspace data.
- Startup loads config in `src/main.tsx`, injects either prod or dev `WorkspaceSource`, injects either prod or dev workspace persistence, opens onboarding when prod lacks auth, and opens the local-first workspace switcher when the active env has no saved workspace.
- Project selection already calls `source.loadWorkspace()`, persists the selected workspace, and applies the loaded workspace into shared app state.
- UI state already has project, board, sprint, status, issue, issue draft, delete draft, config draft, search, and remote-write review fields.
- Rendering already reads from shared state/selectors; Jira calls should stay out of route/component render code.

## Non-Negotiables

- Dev env must be explicit and must keep working without credentials.
- Prod env must not silently fall back to fixture data when credentials are missing; it should open auth onboarding instead.
- Prod selections persist under `prodWorkspace` and `prodRecentWorkspaces`; dev selections persist under `devWorkspace` and `devRecentWorkspaces`; auth saves must preserve both.
- UI components must not import Jira endpoint functions directly.
- Raw Jira DTOs must not leak beyond `src/jira/*` and loader/normalizer tests.
- `/` remains `Filter loaded`; remote Jira/JQL search is a separate mode.
- Small `w` only renders staged local overlays. It must not mutate base loaded Jira data or clear drafts.
- `X` discards staged overlays. `W` reviews and later applies remote Jira writes.
- Explicit refresh should replace loaded base data only after a successful request/normalization pass.
- Workspace switches must not show issues from the previous project/board as if they belong to the newly selected project/board.
- If staged changes exist during a workspace switch, the app must ask the user to discard/keep working before changing workspaces.
- In-flight issue/detail requests need stale-response protection so older responses cannot overwrite newer selections.

## Proposed Shape

Keep the API layer small and endpoint-oriented:

- `src/jira/client.ts`: shared request helper, auth header, URL building, error mapping, pagination helpers.
- `src/workspace/prod/source.ts`: API-backed workspace source for prod project selection and future real workspace loading.
- `src/workspace/dev/source.ts`: fixture-backed workspace source for dev project selection and smoke testing without Jira credentials.
- `src/jira/endpoints.ts`: typed read endpoint functions for boards, sprints, issues, comments, and search.
- `src/jira/types.ts`: raw Jira response types used only by endpoint/normalizer code.
- `src/jira/normalize.ts`: Jira DTO to `AppState` domain model conversion.
- `src/jira/loaders.ts`: app-level read orchestration that returns state patches or normalized snapshots.
- `src/jira/errors.ts`: actionable error categories if `JiraApiError` grows beyond HTTP status/message.

The existing `src/jira/client.ts` can be evolved in place instead of moving files first. Split files only when the endpoint set becomes hard to read.

## Project Selection Contract

Project selection is already wired through `WorkspaceSource` and should stay the entry point for real data loading. The chooser is local-first: `P` means "switch workspace," not "load all Jira projects."

Runtime behavior:

- `lazyjira` / `bun run start`: `runtimeEnv = "prod"`, use `createProdWorkspaceSource()`, read/write selected workspace through `prodWorkspace`, and require Jira credentials.
- `lazyjira dev` / `bun run start:dev` / `bun run dev`: `runtimeEnv = "dev"`, use `createDevWorkspaceSource()`, read/write selected workspace through `devWorkspace`, and never require Jira credentials.
- `P` opens saved local workspaces immediately with no remote discovery.
- In the local switcher, `/` filters saved workspaces and `Enter` switches to the selected saved project+board.
- In the local switcher, `a` enters remote project discovery; only this path calls `source.fetchProjects()`.
- Remote project mode filters the cached project list locally with `/`, refreshes it with `r`, and fetches boards only after one project is selected.
- Remote board mode fetches/refreshes boards only for the selected project; `Enter` finalizes the selected project+board.
- `saveSelectedProjectContext()` loads the final selected workspace through `source.loadWorkspace()`, persists the correct workspace config key and recent list through injected persistence, and applies the loaded workspace into state.

When read-only issue loading is added:

- Selecting a prod board should load only that selected workspace through `createProdWorkspaceSource().loadWorkspace()`; today this returns an explicit empty/not-wired workspace, and future phases should replace that with real Jira issue loading.
- Selecting a dev board should keep using fixture data through `createDevWorkspaceSource()`, not real Jira endpoints.
- Same-workspace refresh can keep previous successful data visible until replacement data is ready.
- Cross-workspace switching should either keep the old workspace active until the new load succeeds or switch to a clear loading/empty/error state; it must not display old issues under the new project header.
- If there are staged issue/config changes, project switching should open a confirmation/discard path before changing workspace context.
- Discovery errors should remain scoped to the picker; workspace loading errors should render in the workspace/board/backlog surfaces.

## Read Endpoints

Use Jira Cloud endpoints first. Data Center support can be added later behind compatibility branches only when required.

| Purpose | Endpoint |
|---|---|
| Projects | `GET /rest/api/3/project/search` |
| Project boards | `GET /rest/agile/1.0/board?projectKeyOrId={projectKey}` |
| Board config/status columns | `GET /rest/agile/1.0/board/{boardId}/configuration` |
| Sprints | `GET /rest/agile/1.0/board/{boardId}/sprint?state=active,future` |
| Active sprint issues | `GET /rest/agile/1.0/sprint/{sprintId}/issue` |
| Backlog issues | `GET /rest/agile/1.0/board/{boardId}/backlog` |
| Issue detail | `GET /rest/api/3/issue/{issueKey}` |
| Comments | `GET /rest/api/3/issue/{issueKey}/comment` |
| Remote search | `GET /rest/api/3/search/jql` |

Issue list/detail reads should request only fields the current domain model can use first:

- `summary`, `issuetype`, `priority`, `status`, `assignee`, `reporter`
- `parent`, `labels`, `components`, `fixVersions`, `versions`
- `description`, `comment`, `issuelinks`, `subtasks`, `attachment`
- sprint/rank/story-points fields once field IDs are discovered from board metadata
- `created`, `updated`, `duedate`, `resolution`

## Loading Model

Add loaders that sit between commands and Jira endpoints:

- `loadWorkspaceOverview(auth, workspace)` loads board config, sprints, active sprint issues, and backlog issues for the selected `workspace` config.
- `loadIssueDetail(auth, issueKey)` loads full issue detail and comments for the selected issue.
- `searchRemoteIssues(auth, query, workspace)` runs explicit paginated remote search and returns issue summaries.

The loader result should normalize into the same state shape used by demo data:

- `project`, `board`, `sprints`, `activeSprintId`
- `statuses`, `columns`, `issueTypes`
- `issues` keyed by issue key
- selected issue preservation when the key still exists, otherwise first visible issue

Do not clear `issueDrafts`, `issueDeletes`, or `configDrafts` during a read refresh unless the user explicitly discards them. If a refreshed issue has staged local fields, rendering should continue through `issueWithDraft()`.

## Pagination And Refresh

Jira list endpoints are paginated. Use one generic helper that accepts `startAt`, `maxResults`, and the endpoint-specific done signal (`isLast` or `startAt + values.length >= total`).

Initial defaults:

- Board/sprint discovery: fetch all pages.
- Active sprint issues: fetch all pages for the active sprint.
- Backlog: fetch the first bounded set, then add explicit `load more` behavior before attempting full backlog sync.
- Remote search: always paginated and user-driven.

Refresh commands should expose clear loading/error state and keep the previous successful data visible until replacement data is ready when the selected workspace has not changed.

## Search Model

Keep two distinct search paths:

- Loaded filter: `/` filters `state.issues` already loaded into memory and respects staged overlays.
- Remote search: a future command/mode sends JQL or text search to Jira and displays paginated results separately.

Do not implement `/` by fetching every Jira issue. For large Jira sites, remote search must be explicit and bounded.

## Error Model

Map failures into user-actionable messages:

- Missing credentials: prompt auth setup.
- `401`: credentials rejected; ask user to re-login or refresh token.
- `403`: account lacks permission for the project, board, or issue.
- `404`: project, board, sprint, or issue no longer exists or is not visible.
- `429`: rate limited; show retry guidance if Jira returns `Retry-After`.
- Network failure: show site URL and connectivity hint.
- Invalid response: show endpoint context and keep previous data.
- Jira validation error: preserve Jira's field-level message when writes are added.

Errors should be shown in the existing toast/dialog surfaces and stored near the relevant loading state so the UI can render an empty/error panel where appropriate.

## Staged Writes Plan

Remote writes should build on existing staged state instead of adding a second edit model.

The `W` path should eventually convert `stagedChanges(state)` into Jira operations:

- field edits: `PUT /rest/api/3/issue/{issueKey}` with field IDs from metadata
- transitions: `POST /rest/api/3/issue/{issueKey}/transitions`
- comments: `POST /rest/api/3/issue/{issueKey}/comment`
- rank: Jira Agile rank endpoint after backlog ranking is modeled
- sprint move: Jira Agile sprint/backlog endpoint after move actions are modeled
- delete: keep disabled or highly confirmed until product explicitly allows remote deletes
- config drafts: keep local/demo-only until real Jira admin metadata writes are intentionally scoped

Before remote writes are implemented, `W` should continue to show a review and keep staged changes intact. When writes are implemented, failures must leave failed staged changes in place and report the exact Jira reason.

## Task Breakdown

### A0. Auth, Runtime Env, And Workspace Source Baseline

Status: complete.

Implementation:

- Keep `src/auth/config.ts` as the source of local Jira auth and workspace config.
- Keep separate `prodWorkspace` and `devWorkspace` persistence for prod and dev selections.
- Keep project/board picker reads behind `WorkspaceSource` so prod calls `fetchAccessibleProjects()`/`fetchProjectBoards()` and dev uses fixtures.
- Keep normal startup in prod and make dev startup explicit through `dev`.

Verification:

- Unit tests for runtime-env parsing, config preservation, prod source discovery, dev source loading, and full `bun test`.

### A1. Client Foundation And Error Mapping

Implementation:

- Extend the Jira request helper with endpoint context and headers.
- Add typed pagination helpers.
- Add structured error categories while preserving current `JiraApiError` behavior.

Verification:

- Unit tests for successful JSON, empty bodies, invalid JSON, `401`, `403`, `404`, `429`, and network failures.

### A1.5. Local Workspace Switcher And Remote Browse Mode

Status: complete.

Implementation:

- Make `P` open a local workspace switcher first, backed by saved prod/dev recent workspaces.
- Add an explicit key in the popup, currently planned as `a`, to browse/add a new remote Jira workspace.
- Do not fetch remote projects when the local switcher opens.
- Fetch remote projects only after entering remote browse mode or explicitly refreshing remote discovery.
- Fetch boards only after one remote project is selected.
- Sync/fetch workspace data only after the final project+board context is selected.
- Persist the final selection as active workspace and add/move it in recent workspaces.
- Block or confirm switching when staged issue/config changes exist.

Verification:

- Config tests for recent workspace persistence.
- Project picker tests proving `P` does not call remote discovery.
- Project picker tests proving remote discovery only starts from the explicit remote-browse key.
- State tests proving final workspace loading happens only after board selection.

### A2. Board Metadata Loader

Status: in progress. Board configuration, columns, status IDs, and project status-name enrichment are wired; issue type/custom field discovery remains.

Implementation:

- Read board configuration and normalize Jira columns/statuses into `StatusDefinition[]` and `StatusColumn[]`, enriched by project workflow status names.
- Discover issue type and important custom field metadata needed by issue normalization.

Verification:

- Fixture tests for board columns, unmapped statuses, duplicate status names, and unknown status categories.

### A3. Sprint And Backlog Issue Loading

Status: in progress. Active/future sprint discovery and active sprint issue loading are wired; bounded backlog loading remains.

Implementation:

- Load active/future sprints for the selected board.
- Load active sprint issues.
- Load an initial bounded backlog page.
- Normalize loaded issues into `Record<string, IssueSummary>` without touching staged drafts.

Verification:

- Fixture tests for active sprint, future sprint, backlog-only issues, unassigned users, missing priorities, and missing custom fields.

### A4. Project Selection And Workspace Loading Integration

Implementation:

- Add loading/error state for project switch, workspace refresh, and issue detail refresh.
- Add commands/actions that call loaders from the state layer, not render components.
- After a real board is selected, load the selected workspace's board metadata, sprints, active sprint issues, and bounded backlog data.
- Keep dev board selection on fixture data and out of real Jira endpoints.
- Prevent stale previous-workspace issues from rendering under a newly selected project/board.
- Preserve selected issue when possible and fall back safely when it disappears.
- Block or confirm workspace switching when staged issue/config changes exist.

Verification:

- State tests for project switch success, project switch failure, same-workspace refresh preserving old data, cross-workspace stale data prevention, selected issue fallback, and staged-change switch confirmation.

### A5. Issue Detail Loading

Implementation:

- Load full issue detail and comments on explicit detail open or refresh.
- Merge detail fields into the selected issue's base data while keeping staged overlays visible.
- Protect against stale responses when selection changes quickly.

Verification:

- Unit tests for detail merge, comments, attachment/link/subtask normalization, and stale-response ignore.

### A6. Remote Search Mode

Implementation:

- Add a separate remote search command/mode distinct from `/` loaded filtering.
- Run bounded Jira search, show paginated results, and let `Enter` open/load detail.

Verification:

- Tests proving `/` does not call Jira and remote search does call the search loader.

### A7. Safe Write Review Preparation

Implementation:

- Keep `W` as review-only until write endpoints are explicitly added.
- Add translation tests from `StagedChange` to future Jira operation previews.
- Mark unsupported operations as blocked in the review instead of silently dropping them.

Verification:

- Tests for edit, transition, delete-disabled, and config-unsupported preview rows.

### A8. Documentation And Smoke Checks

Implementation:

- Update README/task docs when real read-only loading lands.
- Add a manual smoke checklist for real Jira credentials.

Verification:

- `bun run typecheck`.
- `bun test`.
- Manual smoke with valid Jira Cloud credentials: project picker, board selection, refresh active sprint, refresh backlog, open issue detail, preserve staged drafts across refresh.
