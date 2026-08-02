# Jira Project Navigation Epic

## Goal

Align a selected Jira project's terminal navigation with Jira Software while preserving lazyjira's persistent, keyboard-first terminal sidebar.

The project section of the sidebar should present:

- Timeline
- Backlog
- List
- Active sprints for Scrum boards
- Board for Kanban boards

`Workspace` remains a global lazyjira home/dashboard. `Metadata Config` moves out of the everyday project-view list and remains reachable through the command palette or a settings path. Issue detail remains an internal route.

## Product Decisions

- Keep the existing left terminal sidebar. Do not replace it with a horizontal tab bar.
- A sidebar route represents either a global destination or a project destination; the active project/board is always visible above both sections.
- Scrum uses **Active sprints** as its board destination. Kanban uses **Board**. They share the existing board renderer where possible.
- Backlog remains project-aware and shows sprint planning for Scrum. Kanban should show its project backlog without pretending it has sprint planning.
- List is a project-wide, paginated issue reader optimized for scanning, filtering, opening, and staged safe edits.
- Timeline is a read-only hierarchy/schedule overview. It groups parent/child work and uses start and due dates when available.
- No route or UI component calls Jira directly. New project-view data is loaded through workspace sources, state, and selectors.
- Missing Jira metadata must produce an explicit empty/unavailable state, never invented timeline dates or hierarchy.

## Target Sidebar

```text
lazyjira
PROJ Product Platform
Scrum board: Delivery

Global
  Workspace

Project
  Timeline
  Backlog
  List
  Active sprints

Quick Filters
  [ ] Assignee: me
  [ ] Blocked
```

For a Kanban board, replace `Active sprints` with `Board`.

## Experience Translation

The goal is not to draw Jira's browser chrome in a terminal. The goal is to preserve the same project mental model and make every frequent interaction keyboard-native.

| Jira web concept | Terminal translation |
|---|---|
| Project navigation tabs | Persistent sidebar `Project` section |
| Selected project and board | Fixed sidebar header and main-surface header |
| Timeline canvas | Hierarchy rows plus horizontally scrollable date cells |
| Backlog sprint panels | Vertically stacked, collapsible sprint/backlog groups |
| List table | Dense row table with an adjacent issue inspector |
| Active sprint board | Existing status-column board plus inspector |
| Issue modal/page | Existing issue-detail route; `Esc` returns to the originating view |
| Browser filters | `/` filters loaded rows; `S` remains explicit remote Jira search |
| Jira inline edits | Inspector edits stage locally; `W` reviews and applies remotely |
| Project settings | Command-palette/settings destination, not a daily project tab |

### End-To-End Daily Flows

Sprint execution:

1. Start in the last saved project and project view.
2. Press `5` to open Active sprints for a Scrum board.
3. Use `h/l` to choose a status column and `j/k` to inspect cards.
4. Use `s`, `a`, `c`, or `p` to stage status, assignee, comment, or priority changes.
5. Press `W` to review exact Jira operations, confirm, and refresh affected issues.
6. Press `Esc` after issue detail to return to the same card and column.

Backlog grooming:

1. Press `3` to open Backlog.
2. Use `h/l` to move among sprint/backlog groups and `j/k` among issues.
3. Use `J/K` to stage rank changes, `m` to move work, and `n` to create in the focused planning group.
4. Open the inspector with `Tab` for type, parent, estimate, and assignee edits.
5. Press `W` to review and apply the staged grooming batch.

Project triage:

1. Press `4` to open List.
2. Press `/` and enter a loaded filter such as `status:blocked assignee:duy`.
3. Use `j/k`, `g/G`, and `Ctrl-u/d` to scan matching rows.
4. Press `Enter` for detail or stage a field action directly.
5. Press `S` only when the needed issue is not loaded and a Jira-backed search is intentional.

Roadmap review:

1. Press `2` to open Timeline.
2. Use `j/k` to traverse hierarchy and `Space` to collapse parent work.
3. Use `h/l` to pan and `z` to change time scale.
4. Identify unscheduled or partially loaded work from explicit row/header markers.
5. Open an issue, stage Due date or parent edits through the inspector, and return to the same Timeline row with `Esc`.

The persistent shell remains three logical panes on wide terminals:

```text
┌─ Sidebar ─────────────┐┌─ Current project view ─────────────────────────────┐┌─ Inspector ─────────────┐
│ Project and board     ││ Timeline / Backlog / List / Active sprints         ││ Selected issue           │
│ Global destinations   ││                                                     ││ Fields and safe actions  │
│ Project destinations  ││                                                     ││                         │
│ Quick filters         ││                                                     ││                         │
└───────────────────────┘└─────────────────────────────────────────────────────┘└─────────────────────────┘
```

`Tab` and `Shift-Tab` move pane focus. Vim movement operates inside the focused pane and never silently changes another pane's selection.

## Sidebar Interaction Specification

The sidebar is stable across project views. Its width should remain fixed unless the terminal enters the narrow stacked layout.

```text
lazyjira
PROJ Product Platform
Delivery · Scrum

Global
  Workspace

Project
  Timeline
  Backlog
  List
> Active sprints

Quick Filters
  [x] Assignee: me
  [ ] Blocked
  [ ] Stale
  [ ] Unassigned

Pending
  3 staged changes
```

Sidebar behavior:

| Key | Result |
|---|---|
| `j` / `Down` | Select the next destination or quick filter |
| `k` / `Up` | Select the previous destination or quick filter |
| `g` | Select the first sidebar item |
| `G` | Select the last sidebar item |
| `Enter` / `l` | Open a destination |
| `Space` | Toggle a selected quick filter |
| `h` | Stay at the left navigation boundary; no hidden route change |
| `q` | Quit when no modal, editor, detail, or child surface can close |
| `P` | Open the project/board switcher |

Quick filters apply to Timeline rows, Backlog issues, List rows, and board cards using the same loaded-data selector semantics. Filters do not trigger Jira requests.

## Project View Wireframes

### Timeline

Wide layout:

```text
Timeline · PROJ Product Platform · Jul 27-Aug 23 · Week
j/k row · g/G ends · Ctrl-u/d half page · h/l pan · [/] viewport · Space collapse · z zoom · t today
100/482 project issues loaded · partial · L load more
Start date field unavailable; showing Due-only, sprint-window, and unscheduled rows.
 Work                    Jul 27    |Aug 03    Aug 10     Aug 17
> v PROJ-10 Auth         ███████████████████
    · PROJ-21 Login           ███████
    · PROJ-22 OAuth              ◆             Start Aug 05 only
  > PROJ-30 Billing                              █████████████
    · PROJ-44 Cleanup      ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒  Sprint 24 window Jul 27 -> Aug 07
  + New initiative

Parent not loaded
  ? PROJ-55 Imported      parent not loaded: EXT-4 · Due Aug 21 only

Invalid hierarchy
  ! PROJ-60 Cycle         invalid hierarchy · unscheduled

`|` marks the date cell containing today. Bars and markers are clipped only at
the fixed window boundary; issue identity and schedule meaning remain visible.
```

Timeline row rules:

- Parent rows use the configured parent issue-type color and a disclosure marker.
- The first loaded Timeline projection defaults to Month zoom with loaded parent rows collapsed; later user zoom and expansion choices are preserved for the workspace.
- Child rows are indented by hierarchy depth; depth is derived from actual parent links, not hardcoded issue type names.
- A bar begins at Start date and ends at Due date, inclusive.
- A one-date issue renders a one-cell milestone marker only when Jira provides exactly one scheduling date; the UI labels which date is present.
- Missing both dates uses a visibly distinct sprint-window bar only when the issue belongs to a sprint with both dates; this is contextual fallback, not a synthetic issue Start or Due date. Otherwise it renders `unscheduled`.
- A missing parent appears in a `Parent not loaded` group until hydrated.
- Cycles or invalid parent chains are cut at the first repeated key and marked `invalid hierarchy` instead of recursing.
- Collapsing a parent changes only the visible row projection. Loaded issue entities and project-list membership are unchanged.
- Completed issues use a subdued success tone; blocked issues retain the warning marker.
- Timeline is read-only in Wave 5. Issue fields can still be staged through the inspector, but bars cannot be dragged or resized.
- The header always names the project, loaded/total completeness, zoom, and inclusive date window. Start-field discovery and parent-hydration failures are nonfatal notice lines.

Timeline keyboard behavior:

| Key | Result |
|---|---|
| `j` / `k` | Next/previous visible hierarchy row |
| `g` / `G` | First/last visible row |
| `Ctrl-d` / `Ctrl-u` | Half-page rows down/up |
| `h` / `l` | Pan date window left/right by one visible time unit |
| `[` / `]` | Pan date window left/right by one full viewport |
| `Space` | Collapse/expand a parent row |
| `z` | Cycle Day, Week, and Month zoom |
| `t` | Return the date window to today |
| `Enter` | Open selected issue detail; on the final create row, create the highest configured non-subtask hierarchy level |
| `e`, `a`, `s`, `c`, `p`, `o` | Existing issue edit, assign, transition, comment, priority, and browser actions |
| `L` | Load the next project issue page when available |
| `r` | Refresh Timeline/List project issue data |

Timeline row navigation updates the shared selected issue, so the inspector
tracks the row immediately. Modal, search, editor, and inspector-choice bindings
retain precedence over Timeline printable keys. Opening detail records Timeline
as the originating route; `Esc` restores the same selected key, collapsed
projection, zoom, and date-window start.

Narrow layout removes the horizontal grid and renders schedule text without losing hierarchy:

```text
v PROJ-10 Auth
  Jul 28 -> Aug 14
  PROJ-21 Login
    Jul 30 -> Aug 05
  PROJ-22 OAuth
    unscheduled
```

The date grid is enabled when the main viewport can retain the issue
identity column plus at least three complete cells at the active zoom. Otherwise
the textual layout is used for every row; it never renders a clipped bar that
could imply different dates. Long row lists remain viewport-culled in both
layouts.

### Backlog

Wide layout keeps the existing stacked planning model and makes its relationship to Jira clearer:

```text
Backlog · 63/140 loaded

v Active · Sprint 24 · Jul 27-Aug 07             8 issues · 21 points
  PROJ-101  Finish OAuth                         Story  5  Duy
  PROJ-102  Retry checkout                       Bug    3  Mina

> Future · Sprint 25                             12 issues · 30 points
  PROJ-120  Account recovery                     Story  8  Unassigned

v Backlog                                        43 loaded
  PROJ-140  Replace token cache                  Task   -  Duy

j/k issue  h/l group  J/K rank  m move  n create  L load more
```

Backlog rules:

- Scrum shows active sprint, future sprint, and backlog groups.
- Kanban shows the board backlog as one planning group and does not display sprint-only controls.
- Empty future sprint groups remain focusable so users can create or move work into them.
- Rank preview and move actions preserve existing staged-write safety.
- `L` loads the focused group when it has another Jira page.
- Parent badges render only for loaded ancestors above Jira's standard issue hierarchy level; Story-level parents stay hidden in Backlog. Estimate, assignee, and issue-type color remain visible without opening detail.

Backlog keyboard behavior:

| Key | Result |
|---|---|
| `j` / `k` | Next/previous issue in the focused group |
| `h` / `l` | Previous/next sprint or backlog group |
| `g` / `G` | First/last issue in the group |
| `Ctrl-d` / `Ctrl-u` | Half-page down/up |
| `Space` | Collapse/expand the focused group |
| `J` / `K` | Stage rank after/before the adjacent issue |
| `m` | Open move-to-sprint/backlog picker |
| `n` | Create a draft in the focused group |
| `L` | Load another page for the focused group |
| `Enter` | Open issue detail; on an empty group, create a draft |

### List

The List is project-wide, not merely a reformatted active sprint or backlog page.

```text
List · PROJ · 100/482 loaded · Updated desc

  Key       Summary                         Type    Status       Assignee    Pri  Parent     Due
> PROJ-211  OAuth callback intermittently   Bug     In Progress  Duy         H    PROJ-10    Aug 03
  PROJ-210  Add recovery email              Story   To Do        Unassigned  M    PROJ-10    Aug 08
  PROJ-209  Remove old token cache          Task    Done         Mina        L    -          -

j/k row  g/G ends  ctrl-u/d page  enter detail  / filter  S Jira search  L load more
```

List rules:

- Default scope is all issues in the selected project visible to the authenticated user.
- Default order is Jira Rank when the field is available; fallback order is `updated DESC, key DESC`.
- Required columns are Key, Summary, Type, Status, Assignee, Priority, Parent, and Due date.
- Optional columns such as Sprint, Story points, Labels, and Updated can be toggled later; column customization is not required for N3.
- The selected row drives the shared inspector.
- `/` filters only loaded rows and preserves the remote paging cursor.
- `S` remains the separate explicit Jira search surface and must not alter List's base query.
- Appended pages dedupe by issue key and preserve the currently selected row.
- Parent rows follow Jira's loaded parent links and use List-specific collapse state; collapsing List never changes Timeline collapse state.

List keyboard behavior:

| Key | Result |
|---|---|
| `j` / `k` | Next/previous row |
| `g` / `G` | First/last loaded row |
| `Ctrl-d` / `Ctrl-u` | Half-page down/up |
| `h` / `l` | Horizontal table scroll when columns overflow |
| `Space` | Collapse/expand the selected parent row |
| `Enter` | Open selected issue detail |
| `/` | Filter loaded rows |
| `S` | Open explicit remote Jira search |
| `L` | Load the next project issue page |
| `r` | Reload from the first page while preserving old rows until success |
| `n` | Create a project issue draft with no implied sprint |

### Active Sprints / Board

Scrum label and header:

```text
Active sprints · Sprint 24 · Jul 27-Aug 07
Goal: Stabilize authentication and checkout

To Do              In Progress         Review              Done
PROJ-101            PROJ-102            PROJ-099            PROJ-080
Finish OAuth        Retry checkout      Validate SSO        Cache cleanup
```

Kanban label and header:

```text
Board · Delivery Kanban · 100/240 loaded

Selected            In Progress         Review              Done
```

Board rules:

- Scrum displays issues from the active sprint endpoint and sprint goal/date context.
- Kanban displays bounded board issue pages and explicit load-more state.
- Both reuse status columns, card rendering, grouping, inspector, and draft creation.
- Scrum must not show a redundant Kanban destination. Kanban must not show an Active sprints destination.

Board keyboard behavior remains Vim-like:

| Key | Result |
|---|---|
| `j` / `k` | Next/previous card in a column |
| `h` / `l` | Previous/next status column |
| `g` / `G` | First/last card in the column |
| `Ctrl-d` / `Ctrl-u` | Scroll board viewport |
| `Enter` | Open issue detail or create from a selected create card |
| `n` | Create in current status/group context |
| `L` | Load another Kanban board page when available |

## Global Key Contract

The same global keys apply from every project view unless an editor or modal owns input:

| Key | Result |
|---|---|
| `?` | Context-aware help generated from active command bindings |
| `;`, `:` | Command palette |
| `P` | Switch project/board workspace |
| `Tab` / `Shift-Tab` | Next/previous pane |
| `Esc` | Cancel editor/modal; from detail, return to originating view |
| `q` | Back/close; quit only when no child surface can close |
| `/` | Filter loaded issues in the current view |
| `S` | Explicit remote Jira search |
| `r` | Refresh current route data |
| `R` | Refresh complete workspace metadata and current route data |
| `w` | Render staged changes locally |
| `W` | Review/apply staged Jira changes |
| `X` | Select staged changes to discard |
| `1` | Workspace |
| `2` | Timeline |
| `3` | Backlog |
| `4` | List |
| `5` | Active sprints or Board according to selected board type |

`p` returns to its Jira action meaning, Priority, when an issue is selected. The command palette retains `;` and `:`. `Config` loses its numeric route binding and remains discoverable as `Open metadata config` in the command palette until a dedicated settings hierarchy exists.

Issue action keys are consistent across Timeline, Backlog, List, Board, and Inspector focus:

| Key | Result |
|---|---|
| `e` | Edit selected field or issue body according to focused pane |
| `a` | Assign selected issue through the Jira user picker |
| `s` | Select a valid Jira status transition |
| `c` | Compose a staged comment |
| `p` | Select priority |
| `o` | Open selected issue in the browser |
| `n` | Create a draft using current project/view context |

## Jira API Contract

Only documented Jira Cloud REST APIs may be used. Do not call private endpoints observed in Jira web network traffic; they are unsupported and likely to change.

### Workspace Metadata

| Data | Request | Loading policy |
|---|---|---|
| Project | `GET /rest/api/3/project/search` | Explicit project switcher discovery |
| Boards | `GET /rest/agile/1.0/board?projectKeyOrId={project}` | After selecting a project |
| Board columns/filter/type | `GET /rest/agile/1.0/board/{boardId}/configuration` | Workspace load/refresh |
| Project statuses | `GET /rest/api/3/project/{projectKey}/statuses` | Workspace load/refresh |
| Jira fields | `GET /rest/api/3/field` | Workspace load; cache per site |
| Create issue types | `GET /rest/api/3/issue/createmeta/{projectKey}/issuetypes` | Workspace load/refresh |
| Sprints | `GET /rest/agile/1.0/board/{boardId}/sprint?state=active,future` | Scrum workspace load/refresh |

### View Reads

| View | Request | Query/paging |
|---|---|---|
| Active sprints | `GET /rest/agile/1.0/sprint/{sprintId}/issue` | Fetch all pages for each active sprint |
| Scrum backlog | `GET /rest/agile/1.0/board/{boardId}/backlog` | First bounded page, then `L` |
| Kanban board | `GET /rest/agile/1.0/board/{boardId}/issue` | First bounded page, then `L` |
| Project List | `GET /rest/api/3/search/jql` | Project JQL, `maxResults`, `nextPageToken`/cursor |
| Timeline | Reuse Project List issue pages | No separate private roadmap endpoint |
| Issue detail | `GET /rest/api/3/issue/{issueKey}` | On open/explicit refresh |
| Comments | `GET /rest/api/3/issue/{issueKey}/comment` | On detail load; bounded initially |
| Missing parents | `GET /rest/api/3/search/jql` | Batched `key IN (...)`, never one request per row |

Project List base JQL:

```text
project = "PROJ" ORDER BY Rank ASC
```

If Jira does not expose a usable Rank field:

```text
project = "PROJ" ORDER BY updated DESC, key DESC
```

The project key must be escaped by a JQL value helper. Never interpolate raw user input into JQL. User-entered remote search remains handled by the existing explicit search path.

Requested project issue fields:

```text
summary,issuetype,status,priority,assignee,reporter,parent,
labels,components,fixVersions,versions,created,updated,duedate,resolution,
<sprintFieldId>,<rankFieldId>,<storyPointsFieldId>,<startDateFieldId>
```

Field IDs are included only when discovered. `Start date` must be discovered from `GET /rest/api/3/field`; no tenant-specific custom field ID is hardcoded. Prefer a Jira system Start date field when its schema identifies one. Otherwise accept one exact case-insensitive `Start date` field with a date schema. If multiple candidates remain, mark Start date unavailable and report the ambiguity instead of choosing silently.

### Timeline Data Acquisition

Timeline is a projection of project issue data:

1. Load the first Project List page and normalize issues into the shared issue map.
2. Discover the Start date field ID by schema/name from Jira fields.
3. Read Due date from Jira's `duedate` field.
4. Read parent key/title/type from the `parent` field when Jira includes it.
5. Collect parent keys absent from the shared issue map.
6. Hydrate missing parents in bounded chunks through search JQL such as `key IN ("PROJ-1","PROJ-2")`.
7. Build hierarchy rows locally with cycle protection.
8. Append further project pages only through explicit load-more or route prefetch policy.

Timeline completeness must be visible. Example: `Timeline · 100/482 project issues loaded`. The UI must not imply that a partially loaded hierarchy is the complete project roadmap.

### Pagination Sources

Each view owns independent page state:

| Source ID | Purpose |
|---|---|
| `backlog` | Board backlog page |
| `board` | Kanban board page |
| `sprint:{id}` | Sprint issue page |
| `project-list` | Project List and Timeline base issue cache |
| `timeline-parents` | Batched missing-parent hydration, if separate state is required |
| `remote-search` | Explicit user remote search |

List and Timeline share normalized issue entities but not selection, scroll, or rendering state. The `project-list` cursor is preserved when switching between them.

### Request Lifecycle

- Entering List starts its first project page only if no successful page exists for the current project.
- Entering Timeline reuses project pages already loaded by List and loads the first page if absent.
- Same-workspace refresh keeps previous successful rows visible and marks them refreshing.
- Cross-workspace switch clears route page cursors before applying the new project header.
- Every async route load carries a workspace generation and route request ID; stale responses are ignored.
- `429` retains data and shows retry guidance. It does not automatically spin retries.
- Appending a page dedupes by issue key and advances by Jira's returned cursor/done signal.
- A failed page append retains prior pages and leaves `L` retry available.

## Domain And State Contract

Expected state additions are conceptual; exact names may match existing conventions:

```ts
type ProjectViewRoute = "timeline" | "backlog" | "list" | "board"

type RouteDefinition = {
  id: AppRoute
  scope: "global" | "project" | "internal" | "settings"
  label: string | ((board: BoardSummary) => string)
  shortcut?: string
}

type ProjectListViewState = {
  selectedIndex: number
  horizontalOffset: number
  sort: "rank" | "updated"
}

type TimelineViewState = {
  selectedIssueKey?: string
  windowStart: string
  zoom: "day" | "week" | "month"
  collapsedParentKeys: string[]
}
```

Issue domain additions required by Timeline:

- `startDate?: string`
- Existing `dueDate?: string`
- Existing parent key/title/type metadata
- Optional hierarchy incompleteness marker derived by selectors, not persisted on the issue

Board capabilities should be derived once from selected board metadata:

```ts
type BoardCapabilities = {
  mode: "scrum" | "kanban"
  projectBoardLabel: "Active sprints" | "Board"
  supportsSprints: boolean
  supportsSprintBacklog: boolean
}
```

Components consume capabilities and route definitions; they must not repeatedly branch on raw strings throughout render code.

## Responsive Layout Contract

| Width | Layout |
|---|---|
| `>= 120` | Sidebar + main view + inspector |
| `90-119` | Sidebar + main view; inspector becomes a focused stacked pane below or replaces main through `Tab` |
| `< 90` | One pane at a time: sidebar, main, or inspector; active pane name remains visible in footer |

Timeline targets the same maximum of 11 readable time cells for Day, Week, and Month. It reduces that count responsively and switches to textual date ranges when the date grid cannot retain both issue identity and at least three complete cells. List drops optional columns in this order: Updated, Sprint, Parent, Due; Key and Summary never disappear. Board reuses its existing status-window behavior.

Timeline computes its main viewport from the same shell reservation used by the
other overview surfaces. Every granularity reserves at least six terminal cells
per time unit and shares the same 11-cell cap, so finer zooms change the represented
duration rather than multiplying columns. Zoom preserves the visible center date.
Wide rendering is bounded to the calculated cell count; narrow rendering keeps
hierarchy, selection, group warnings, and exact Jira date copy.

## Loading, Empty, Error, And Partial States

Every project view must implement these states explicitly:

| State | Required presentation |
|---|---|
| Initial loading | View name, project context, operation description, `P` switch and `q` quit |
| Refreshing | Previous rows remain visible with a non-blocking refreshing line |
| Empty | Explain whether Jira returned no issues or filters hide loaded issues |
| Partial | Show loaded/total and `L load more` |
| Append failure | Keep rows, show endpoint-specific error, retain `L retry` |
| Permission failure | Name project/view and required Jira access; do not show a generic empty state |
| Missing Timeline dates | Render `unscheduled`, not an API error |
| Missing Timeline field | Explain that Start date is unavailable and continue with Due-only/unscheduled rows |
| No active sprint | Active sprints shows a clear no-active-sprint state and directs users to Backlog |

Timeline lifecycle copy is more specific:

| Timeline state | Presentation |
|---|---|
| Initial loading | `Loading <PROJECT> Timeline project issues...`; no empty-roadmap claim |
| Refreshing with rows | Retained hierarchy plus `Refreshing Timeline · <loaded>/<total> retained...` |
| Partial page | `<loaded>/<total> project issues loaded · partial · L load more` |
| Filtered empty | States that loaded issues remain and active filters hide every Timeline row |
| Jira empty | States that Jira returned no issues for the selected project |
| Permission/error before data | Names Timeline and project; permission copy requires Browse Projects and issue access |
| Append error | Retains rows and cursor, names `L retry`, and shows the Jira error |
| Start field unavailable | Nonfatal notice; Due-only markers and unscheduled rows continue rendering |
| Parent hydration failure | Nonfatal notice plus `Parent not loaded` grouping for unresolved chains |
| Missing dates | `unscheduled`; no synthetic date or milestone |
| One date | `Start <date> only` or `Due <date> only` plus one marker cell in wide mode |
| Invalid date order | Exact Start/Due copy labeled `invalid range`; no bar is rendered |
| Invalid hierarchy | Separate section and `invalid hierarchy`; traversal never recurses through the cycle |

## Command And Focus Architecture

- Keybindings dispatch named commands; route components may register route-local scroll/pan commands through the existing keymap context.
- Global commands are inactive while text input owns the same printable key.
- `?` derives active shortcuts from command metadata instead of duplicating a static screen-specific legend.
- Sidebar selection and current route are separate: moving over a sidebar item does not navigate until `Enter`/`l`.
- Each route preserves its selected issue and scroll position while switching views within the same workspace.
- Opening detail records the originating route and selected issue. `Esc` restores both.
- Quick-filter changes preserve the selected key when still visible; otherwise select the nearest remaining row/card.

## Implementation Boundaries

| Layer | Responsibility |
|---|---|
| `src/jira/client.ts` | Typed public Jira endpoint calls and raw pagination responses |
| `src/jira/normalize.ts` | Raw issue/field/date/parent DTO conversion |
| `src/workspace/prod/source.ts` | Project List pages, parent hydration, endpoint orchestration |
| `src/workspace/dev/*` | Equivalent fixture pages with no credentials |
| `src/state/routes.ts` | Route scope, board-aware labels, legacy route migration |
| `src/state/issue-pages.ts` | Independent source IDs and page state |
| `src/state/*selectors*` | List rows, hierarchy construction, date-window projection |
| `src/context/app-state.tsx` | Request generation, selection, route state, page append/refresh |
| `src/routes/*` | Screen composition only |
| `src/ui/*` | Reusable sidebar, table, timeline row/grid, board, inspector widgets |

Do not add a broad abstraction before two views need it. List may begin as one route and Timeline selectors may remain timeline-specific until reuse is concrete.

## Performance And Safety Budgets

- Initial workspace loading must not eagerly fetch every project issue merely because Timeline or List exists.
- Project List defaults to 50 issues per Jira search page unless measured terminal rendering supports 100 without delayed input.
- Timeline hierarchy and date projection must be memoized selectors over normalized issues; render code must not rebuild the full tree for every row.
- Parent hydration is capped and chunked. One page with 50 issues must not cause 50 parent requests.
- Route switching with cached data should render immediately and load only missing pages in the background.
- `viewportCulling` or equivalent bounded rendering is required for long List and Timeline surfaces.
- Same-workspace refresh must not clear staged edits or replace successful data with an error state.
- Cross-workspace data must never appear under the newly selected project header while the new request is pending.
- Timeline and List remain read-only projections; all mutations continue through the existing staged-write review path.

## Acceptance Matrix

| Scenario | Timeline | Backlog | List | Active sprints/Board |
|---|---|---|---|---|
| Scrum project | hierarchy/schedule | sprint groups | all project issues | Active sprints |
| Kanban project | hierarchy/schedule | board backlog | all project issues | Board |
| No issues | explicit empty | empty groups | explicit empty | explicit empty |
| Partial Jira page | count + `L` | group count + `L` | count + `L` | Kanban count + `L` |
| Local filter hides all | filtered-empty copy | filtered-empty copy | filtered-empty copy | filtered-empty copy |
| Append fails | rows retained | rows retained | rows retained | rows retained |
| Missing Start date | Due-only/unscheduled | unaffected | blank date | unaffected |
| Missing parent | marked incomplete | parent key if known | parent key if known | parent badge if known |
| Narrow terminal | textual ranges | stacked groups | reduced columns | status window |
| Open/return detail | same row/window | same group/row | same row/offset | same card/column |

## Definition Of Done

Wave 5 is complete only when:

- The sidebar information architecture matches the selected board type and contains no duplicate Scrum/Kanban board destinations.
- All documented keys are discoverable through `?` and match active command bindings.
- Timeline, Backlog, List, and Board use shared issue entities and preserve independent view state.
- Project List and Timeline use only public Jira Cloud REST APIs and escaped generated JQL.
- Partial data is labeled on every project-wide surface.
- Dev mode exercises every state without credentials.
- Unit, state, API, render, narrow-terminal, and legacy-route migration tests pass.
- Scrum and Kanban smoke checks pass against a non-production Jira site.
- `bun run typecheck`, `bun test`, and `git diff --check` pass.

## Route Model

The target route model separates navigation concepts from renderer reuse:

- Global: `workspace`
- Project: `timeline`, `backlog`, `list`, `board`
- Internal: `issue-detail`
- Settings: configuration is excluded from normal sidebar routes

Persisted `active-sprint` and `kanban` values are normalized to `board` while config is parsed. They are migration inputs only, not `AppRoute` values or route components. Internal `BoardMode` strings remain because the unified board renderer still distinguishes Scrum active-sprint data from Kanban board data.

## Delivery Phases

### N1: Navigation Foundation

Deliver:

- Route definitions with global/project/internal grouping and board-aware labels.
- Sidebar sections and selected-state behavior preserving `j/k`, `Enter`, `Tab`, and quick filters.
- Command palette and help updates; no stale `Kanban` or `Metadata Config` project-view entries.
- Safe compatibility handling for a saved legacy route.

Read first:

- `src/state/routes.ts`
- `src/context/app-state.tsx`
- `src/app.tsx`
- `src/ui/shell.tsx`
- `src/keymap/commands.ts`

Verify:

- Route/sidebar tests cover Scrum and Kanban labels.
- A saved legacy board route opens the equivalent board view.
- `?` and the command palette expose the new navigation.

### N2: Board And Backlog Alignment

Deliver:

- One board route backed by the existing board renderer.
- Scrum labeling and active-sprint behavior preserved.
- Kanban labeling and bounded board pagination preserved.
- Backlog copy, empty states, and actions accurately distinguish sprint and non-sprint projects.

Read first:

- `src/routes/board.tsx`
- `src/ui/board.tsx`
- `src/routes/backlog.tsx`
- `src/state/board-navigation.ts`
- `src/state/issue-pages.ts`

Verify:

- Board navigation, draft creation, inspector behavior, load-more, and active-sprint behavior regressions are covered.
- Narrow layouts remain usable.

### N3: Project List

Deliver:

- Paginated project-wide issue loading distinct from loaded-data filtering and remote Jira search.
- A dense keyboard-navigable list with key, summary, type, status, assignee, priority, parent, and schedule signals.
- Stable sorting/filtering from local loaded state; no duplicate issue rows across pages.
- Inspector/detail opening and staged edits reuse existing state/write behavior.

Read first:

- `src/workspace/types.ts`
- `src/workspace/prod/source.ts`
- `src/jira/client.ts`
- `src/state/issue-pages.ts`
- `src/state/issue-search.ts`
- `src/routes/workspace.tsx`

Verify:

- Jira pagination, dedupe, loading, empty, and error tests.
- Render tests cover terminal widths and keyboard navigation.

### N4: Timeline Data Model

Deliver:

- Normalize and retain parent key/title/type plus start/due dates required for timeline rows.
- Parent/child selector that tolerates incomplete loaded parents and does not fabricate links.
- Explicit timeline eligibility state: scheduled, unscheduled, and unavailable.
- Fixture coverage for multiple hierarchy levels, missing parents, and unscheduled work.

Read first:

- `src/jira/client.ts`
- `src/jira/normalize.ts`
- `src/state/app-state.ts`
- `src/state/selectors.ts`
- `src/workspace/dev/fixtures.ts`

Verify:

- Normalization/selector tests cover hierarchy and date edge cases.
- Unsupported Jira hierarchy/date data is shown as unavailable, not inferred.

### N5: Timeline Surface

Deliver:

- Read-only timeline rows grouped by parent hierarchy with a fixed date window.
- Clear unscheduled rows and date-window navigation.
- Keyboard access to open an issue and maintain sidebar/main/inspector focus behavior.
- Intentional narrow-terminal fallback: stacked schedule rows rather than clipped bars.

Read first:

- `src/ui/board.tsx`
- `src/routes/backlog.tsx`
- `src/ui/issue-inspector.tsx`
- `docs/OPENTUI_REFERENCE.md`

Verify:

- Render tests for scheduled, unscheduled, empty, and narrow-terminal states.
- Manual smoke in dev and a non-production Jira project.

### N6: Rollout And Cleanup

Deliver:

- Remove retired sidebar labels/routes after compatibility migration is complete.
- Update README examples, build plan, task tracker, scope roadmap, command palette, help, and footer hints.
- Add a real-Jira smoke checklist for Scrum and Kanban projects.
- Use `docs/JIRA_PROJECT_NAVIGATION_SMOKE_CHECKLIST.md` for the concrete non-production checks.

Verify:

- `bun run typecheck`
- `bun test`
- `git diff --check`
- Manual smoke: project switch, each project view, list paging, timeline empty/scheduled states, board behavior, inspector/detail return, and remote write review.

## Non-Goals

- Matching Jira's browser layout or recreating every Jira project feature.
- Timeline drag/drop, scheduling writes, dependencies, releases, goals, or capacity planning.
- Replacing the terminal sidebar with browser-style top tabs.
- Loading every project issue eagerly.
- Moving Jira API calls into UI components.

## Risks And Decisions To Revisit

- Jira plan/advanced-roadmap scheduling fields vary by tenant. N4 must discover mappings and leave unmapped fields unavailable.
- Team-managed parent hierarchy is project-specific. Timeline must use loaded metadata rather than hardcoded Epic/Story assumptions.
- Project List pagination needs an independent source ID so it cannot conflict with backlog, board, or remote search pagination.
- Persisted route migration remains covered even though `active-sprint` and `kanban` are no longer route IDs; keep normalization fixtures as long as older config files can exist.
