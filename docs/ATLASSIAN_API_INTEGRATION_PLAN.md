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
- UI state already has project, board, sprint, status, issue, issue draft, delete draft, config draft, loaded filtering, remote search, and remote-write review fields.
- Rendering already reads from shared state/selectors; Jira calls should stay out of route/component render code.
- Prod startup with a saved workspace renders a local placeholder shell first, then loads board metadata, active/future sprint metadata, all active sprint issues, Jira field IDs for sprint/points/rank, and one bounded backlog page after mount.
- Opening or refreshing an issue detail view now loads full Jira issue detail and comments with stale-response protection.
- Future sprint, backlog, and board issue load-more pages are wired. Explicit remote Jira search is wired through `S`; `W` previews planned and blocked Jira write operations, but write execution is still not wired.

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

Read-only issue loading behavior:

- Selecting a prod board loads only that selected workspace through `createProdWorkspaceSource().loadWorkspace()`.
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
- Active sprint issues: fetch all pages for every active sprint.
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

Before remote writes are implemented, `W` continues to show a planned/blocked operation review and keep staged changes intact. When writes are implemented, failures must leave failed staged changes in place and report the exact Jira reason.

## Remaining API Roadmap

Implement the rest of the Jira API in this order: pagination/state foundation, complete read API, remote search API, write preview/planning, then write execution. Pagination/state comes first because detail loading, search results, backlog load-more, future sprint load-more, and write retries all need the same loading/error/cursor/stale-response model.

### R0. API State And Loader Foundation

Goal: make async Jira work reliable before adding more endpoints.

- Add route-scoped loading and error state for workspace refresh, issue detail, pagination, remote search, and write apply.
- Add request tokens or generation counters so stale issue/detail/search responses cannot overwrite newer selections.
- Move multi-call orchestration into `src/jira/loaders.ts` or equivalent app-level loader functions; keep raw endpoint calls in `src/jira/client.ts`.
- Preserve previous successful data during same-workspace refresh, but never show previous workspace issues under a new project/board header.
- Keep staged `issueDrafts`, `issueDeletes`, and `configDrafts` visible across refresh unless the user explicitly discards them.
- Update copy that still says issue loading or Jira API is generally "not wired" to name the specific unsupported action.

Verification:

- State tests for same-workspace refresh preserving old data on failure.
- State tests for cross-workspace load failure not relabeling old issues as the new workspace.
- Loader tests proving stale detail/search responses are ignored.

### R1. Complete Read API

Goal: make read-only browsing complete enough for daily work.

- Add `GET /rest/api/3/issue/{issueKey}` for full issue detail.
- Add `GET /rest/api/3/issue/{issueKey}/comment` for comments.
- Normalize comments into `IssueComment[]` and merge detail fields into the existing `IssueSummary` without replacing staged overlays.
- Add explicit `r` refresh behavior for the current route and selected issue.
- Add Kanban-board issue loading that is bounded and board-scoped; do not fetch broad `/board/{id}/issue` pages blindly when totals are large.
- Add optional read metadata needed later by writes: priorities, transitions for selected issue, assignable users, and create metadata.

Verification:

- Unit tests for detail merge, comments, attachments/links/subtasks, and missing fields.
- UI/state tests proving opening issue detail triggers detail fetch when stale or missing.
- Dev-runtime tests proving fixture mode never calls Jira.

### R2. Pagination And Load More

Goal: make large boards safe and explicit.

- Introduce a reusable page state: source id, `startAt`, `maxResults`, `total`, `isLast`, `loading`, and `error`.
- Keep `fetchJiraPages()` for small all-page metadata reads; add bounded page readers for backlog, future sprint issues, and board issues. Remote search pagination belongs to R3.
- Add explicit load-more commands for backlog and future sprint sections.
- Keep future sprint issue pages unloaded by default; for example, do not auto-load the `HPCE Test` future sprint with hundreds of issues.
- Dedupe appended issues by key and preserve staged overlays.
- Show loaded count versus total when Jira provides `total`.

Verification:

- Tests for bounded page response metadata.
- Tests for appending pages without duplicating issues.
- Tests for closed-sprint-history issues staying in Backlog unless the Sprint field has active/future values.

### R3. Remote Search API

Goal: add Jira-backed search without changing `/` local filter semantics.

- Keep `/` as loaded-data filtering only.
- Add a separate remote search command/mode, preferably command-palette first to avoid keybinding conflicts.
- Add `GET /rest/api/3/search/jql` with project/board-scoped JQL generation for simple text search.
- Store remote search query, results, selected index, pagination cursor, loading, and error separately from loaded filter state.
- Normalize search result issues into `state.issues` so the inspector and issue detail route work the same way.
- Let `Enter` on a remote result select/open the issue and trigger detail fetch when needed.

Verification:

- Tests proving `/` does not call Jira.
- Tests proving remote search calls Jira with project/board scope.
- Tests for search pagination append/dedupe and failure preserving previous results.

### R4. Write Preview And Operation Planning

Status: partially implemented. `src/state/jira-write-plan.ts` converts current staged issue/config changes into planned field update previews or blocked rows for unsupported/high-risk writes, and the `W` popup renders those rows. Comment and rank planning are still waiting on staged comment/rank models.

Goal: make `W` show exact Jira operations before any mutation.

- Convert `stagedChanges(state)` into typed Jira operation previews.
- Mark unsupported changes as blocked in the review instead of silently dropping them.
- Resolve field IDs for summary, description, priority, labels, components, versions, due date, sprint, story points, and custom fields before writes.
- Resolve status changes through transition IDs, not direct `statusId` field updates.
- Resolve assignees through Jira account IDs before assignee writes.
- Keep config drafts local/demo-only until Jira admin metadata writes are deliberately scoped.
- Keep delete disabled or require a stronger confirmation until product explicitly allows destructive writes.

Verification:

- Planner tests for field edits, transitions, assignee, comments, sprint move, rank, create, unsupported config, and disabled delete.
- Review UI tests proving unsupported rows are visible and supported rows show exact before/after values.

### R5. Write API Execution

Goal: apply supported staged changes safely and keep failed changes staged.

Roll out writes in this order:

- Comments: `POST /rest/api/3/issue/{issueKey}/comment`.
- Field updates: `PUT /rest/api/3/issue/{issueKey}` for summary, description, priority, labels, components, versions, due date, and story points.
- Status transitions: `POST /rest/api/3/issue/{issueKey}/transitions` after transition discovery.
- Assignee: `PUT /rest/api/3/issue/{issueKey}/assignee` after account ID resolution.
- Sprint/backlog moves: Jira Agile sprint/backlog endpoints after exact target confirmation.
- Rank: Jira Agile rank endpoint after adjacent issue context is modeled.
- Create issue: `POST /rest/api/3/issue` after create metadata is available.
- Delete issue: last, only if explicitly approved and heavily confirmed.

Execution behavior:

- Apply only operations marked supported in the review.
- Clear staged rows only after their corresponding Jira operation succeeds.
- Keep failed staged rows intact and show Jira's exact error message.
- Refresh affected issues after successful writes without clearing unrelated staged work.

Verification:

- Endpoint tests for request bodies and error mapping.
- State tests for partial success, partial failure, and retry.
- Manual smoke on a non-production Jira project before enabling high-impact operations.

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
- Keep Jira `statusCategory.colorName` as a fallback color signal, but prefer app semantic status colors for readable terminal contrast.
- Discover issue type and important custom field metadata needed by issue normalization.

Verification:

- Fixture tests for board columns, unmapped statuses, duplicate status names, and unknown status categories.

### A3. Sprint And Backlog Issue Loading

Status: implemented for active/future sprint discovery, all active sprint issue loading, bounded backlog loading, and explicit future sprint issue load-more.

Implementation:

- Load active/future sprints for the selected board.
- Load all active sprint issues.
- Load an initial bounded backlog page.
- Normalize loaded issues into `Record<string, IssueSummary>` without touching staged drafts.

Verification:

- Fixture tests for active sprint, future sprint, backlog-only issues, unassigned users, missing priorities, and missing custom fields.

### A4. Project Selection And Workspace Loading Integration

Status: in progress. Saved prod workspaces now load after the shell renders, with visible loading/failure state, retry, and request-ID protection against stale startup responses. Same-workspace refresh behavior is still pending.

Implementation:

- Add loading/error state for project switch, workspace refresh, pagination, remote search, and issue detail refresh.
- Add commands/actions that call loaders from the state layer, not render components.
- After a real board is selected, load the selected workspace's board metadata, sprints, all active sprint issues, and bounded backlog data.
- Keep dev board selection on fixture data and out of real Jira endpoints.
- Prevent stale previous-workspace issues from rendering under a newly selected project/board.
- Preserve selected issue when possible and fall back safely when it disappears.
- Block or confirm workspace switching when staged issue/config changes exist.
- Render a local placeholder workspace first on prod startup; do not await Jira before rendering the shell.
- Show an explicit loading panel while the selected workspace has no loaded issues, and retain it as an actionable retry panel on failure.

Verification:

- State tests for project switch success, project switch failure, same-workspace refresh preserving old data, cross-workspace stale data prevention, selected issue fallback, and staged-change switch confirmation.

### A5. Issue Detail Loading

Status: implemented for selected issue detail/comments; attachments, links, and subtasks are still placeholder-only.

Implementation:

- Load full issue detail and comments on explicit detail open or refresh.
- Merge detail fields into the selected issue's base data while keeping staged overlays visible.
- Protect against stale responses when selection changes quickly.
- Add route-visible loading and error states for detail/comment loading.
- Add current-route refresh behavior for selected issue detail.

Verification:

- Unit tests for detail merge, comments, attachment/link/subtask normalization, and stale-response ignore.

### A5.5. Pagination And Load More

Implementation:

- Add bounded page readers for backlog, future sprint issues, and board issues. Remote search pagination is tracked under A6/A6.1.
- Add page state with `startAt`, `maxResults`, `total`, `isLast`, `loading`, and `error`.
- Add explicit load-more commands for backlog, future sprint sections, and kanban board issues.
- Deduplicate loaded pages by issue key and preserve staged overlays.

Verification:

- Tests for bounded page metadata, append/dedupe, and no automatic large future sprint loads.

### A6. Remote Search Mode

Status: implemented for explicit `S` remote Jira search, workspace result display, and remote result pagination append/dedupe.

Implementation:

- Add a separate remote search command/mode distinct from `/` loaded filtering.
- Run bounded Jira search, show paginated results, and let `Enter` open/load detail.

Verification:

- Tests proving `/` does not call Jira and remote search does call the search loader.

### A7. Safe Write Review Preparation

Status: implemented for current staged changes. The review is still execution-free.

Implementation:

- Keep `W` as review-only until write endpoints are explicitly added.
- Convert current `StagedChange` rows into future Jira operation previews.
- Mark unsupported operations as blocked in the review instead of silently dropping them.
- Show status edits as blocked transition previews and assignee edits as blocked account-id previews.
- Keep create, delete, and config writes blocked until separately approved or backed by Jira metadata.

Verification:

- Tests for safe field edits, transition/assignee/sprint/custom-field blockers, delete-disabled rows, config-unsupported rows, and draft create folding.

### A7.5. Safe Write Execution

Implementation:

- Apply writes in low-risk order: comment, field update, transition, assignee, sprint/backlog move, rank, create, delete last.
- Clear staged rows only after their matching Jira operation succeeds.
- Keep failed rows staged and show Jira's actionable error.
- Refresh affected issues after successful writes.

Verification:

- Tests for request bodies, partial success, partial failure, retry, and staged-row clearing.

### A8. Documentation And Smoke Checks

Implementation:

- Update README/task docs when real read-only loading lands.
- Add a manual smoke checklist for real Jira credentials.

Verification:

- `bun run typecheck`.
- `bun test`.
- Manual smoke with valid Jira Cloud credentials: project picker, board selection, refresh active sprint, refresh backlog, open issue detail, preserve staged drafts across refresh.
