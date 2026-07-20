# lazyjira-rs

`lazyjira-rs` is a keyboard-first Jira workspace for the terminal.

The goal is not to make a simple ticket browser. The goal is to bring the high-value Jira web workflows into a fast terminal UI: backlog grooming, Kanban tracking, active sprint overview, issue triage, and rich issue/document reading.

We want the speed and muscle memory of the `lazy*` family, but the UI itself should be designed for Jira's real value: seeing work, moving work, tracking sprint health, and drilling into details only when needed.

## Product Direction

Jira is valuable because it gives teams a shared overview of work:

- What is in the backlog?
- What is in the active sprint?
- What is blocked?
- What is stale?
- What is unassigned?
- What is moving across statuses?
- What needs grooming, ranking, assignment, transition, or comment follow-up?

The terminal app should optimize those workflows first.

Issue details and Confluence-style rich documents still matter, but they are the drill-down surface. The main experience should open on a board, backlog, or workspace overview, not on a single issue reader.

## Product Principles

- Overview first, details second.
- Boards and backlog are first-class screens, not just filters over a ticket list.
- Active sprint health should be visible without running reports in the browser.
- Rich ticket/document reading should be beautiful when opened, but should not dominate the default workflow.
- Keyboard actions should be one or two keystrokes for common Jira work.
- The UI should feel native to the terminal, not like a cramped copy of the web page.
- Keep lazy-family navigation muscle memory: `j/k`, `h/l`, `g/G`, `/`, `?`, `q`, `Esc`, `Tab`, `Enter`.
- High-impact writes need confirmation and clear before/after context.
- Jira errors should be actionable, not vague.

## Reference Material

This repo includes two reference submodules:

- `lazyjira/`: useful for lazy-style keybindings, pane layout, command flow, and focused Jira actions.
- `jiratui/`: useful for broad Jira feature coverage, forms, metadata-driven fields, comments, links, attachments, and user-facing error handling.

Use them as reference material. Do not copy their product model blindly. Our direction is an overview-first Jira command center.

## Primary Screens

### 1. Workspace Home

Purpose: give the user a fast starting point.

Should show:

- Projects and boards.
- Active sprint entry points.
- Backlog entry points.
- My assigned work.
- Recently updated issues.
- Blocked/unassigned/stale quick filters.
- Recently opened issues and docs.

### 2. Active Sprint Board

Purpose: track current sprint execution.

Should show:

- Columns by workflow status.
- Issue cards in each status.
- Sprint health summary.
- Blocked, stale, unassigned, and high-priority indicators.
- Quick filters for assignee, epic, type, priority, labels, and blockers.
- Inspector for selected card.

Example direction:

```text
┌─ Workspace ───────────────┐┌─ Active Sprint: Sprint 24 ───────────────────────────────────────────────┐┌─ Inspector ─────────────┐
│ Project: PROJ             ││  To Do              In Progress          Review              Done        ││ PROJ-128                │
│ Board: Product Scrum      ││ ┌───────────────┐   ┌───────────────┐   ┌───────────────┐   ┌─────────┐ ││ Fix login redirect     │
│                           ││ │ PROJ-121      │   │ PROJ-128      │   │ PROJ-117      │   │ PROJ-1  │ ││ Bug · High             │
│ Views                     ││ │ OAuth setup   │   │ Login redirect│   │ Race in loader│   │ Cleanup │ ││ In Progress            │
│ > Active Sprint           ││ │ Task · Medium │   │ Bug · High    │   │ Bug · High    │   │ Done    │ ││ Assignee: Duy          │
│   Backlog                 ││ └───────────────┘   └───────────────┘   └───────────────┘   └─────────┘ ││ Sprint: Sprint 24      │
│   Kanban Board            ││                                                                          ││                         │
│   My Work                 ││ ┌───────────────┐   ┌───────────────┐                                      ││ Actions                 │
│                           ││ │ PROJ-122      │   │ PROJ-130      │                                      ││ s status                │
│ Quick Filters             ││ │ Docs refresh  │   │ Payment retry │                                      ││ a assign                │
│ > Only My Issues          ││ │ Story · Low   │   │ Bug · Medium  │                                      ││ c comment               │
│   Blocked                 ││ └───────────────┘   └───────────────┘                                      ││ e edit                  │
└───────────────────────────┘└──────────────────────────────────────────────────────────────────────────┘└─────────────────────────┘
? help  / search  j/k card  h/l column  s status  a assign  c comment  enter detail
```

### 3. Backlog

Purpose: groom, rank, and plan work.

Should show:

- Active sprint block.
- Future sprint blocks.
- Backlog block.
- Epics and quick filters.
- Ranking movement.
- Move-to-sprint and move-to-backlog actions.
- Sprint capacity and health indicators.

Example direction:

```text
┌─ Workspace ─────────────┐┌─ Backlog: Product Scrum ───────────────────────────────────────────┐┌─ Sprint Health ─────────┐
│ PROJ Product App        ││ Active Sprint: Sprint 24                                           ││ Sprint 24               │
│                         ││ ┌────────────────────────────────────────────────────────────────┐ ││ 42 issues               │
│ Views                   ││ │ > PROJ-128  Bug   High  Fix login redirect       Duy   Auth   │ ││ 18 todo                 │
│   Active Sprint         ││ │   PROJ-121  Task  Med   OAuth setup wizard       An    Auth   │ ││ 16 in progress          │
│ > Backlog               ││ │   PROJ-117  Bug   High  Race in detail loader    Duy   Core   │ ││ 8 done                  │
│   Kanban Board          ││ └────────────────────────────────────────────────────────────────┘ ││                         │
│                         ││ Future Sprint: Sprint 25                                           ││ Warnings                │
│ Quick Filters           ││ ┌────────────────────────────────────────────────────────────────┐ ││ 3 unassigned            │
│ > Only My Issues        ││ │   PROJ-140  Story Med   Improve docs reader     Linh  Docs   │ ││ 2 blocked               │
│   Bugs                  ││ │   PROJ-141  Task  Low   Add board hints        Duy   UI     │ ││ 5 stale > 7d            │
│   Blocked               ││ └────────────────────────────────────────────────────────────────┘ ││                         │
│   Unassigned            ││ Backlog                                                             ││ Actions                 │
│                         ││ ┌────────────────────────────────────────────────────────────────┐ ││ n new issue             │
│                         ││ │   PROJ-160  Task  Low   Cleanup labels        Unassigned     │ ││ m move to sprint        │
└─────────────────────────┘└────────────────────────────────────────────────────────────────────┘└─────────────────────────┘
j/k move  J/K rank  m move to sprint  s transition  / filter  enter detail  tab focus
```

### 4. Kanban Board

Purpose: track continuous-flow projects without sprint structure.

Should show:

- Columns by status.
- Optional WIP limits.
- Swimlanes by epic, assignee, priority, or issue type.
- Blocker/stale signals.
- Fast transition and assignment actions.

### 5. Issue Detail

Purpose: inspect and act on one selected item without losing board/backlog context.

Should show:

- Summary, type, status, priority, assignee, reporter, sprint, labels, components.
- Description as rich document content.
- Comments.
- Subtasks.
- Linked issues.
- Confluence/docs links.
- Attachments.
- Activity/history.
- Actions for transition, assign, priority, comment, edit, copy, and open in browser.

Issue detail can be a drawer, overlay, or full-screen route depending on terminal size.

### 6. Search And Command Palette

Purpose: let users jump anywhere without navigating through panes.

Should support:

- Search issues.
- Search boards/projects.
- Search Confluence/docs links.
- Run actions by name.
- Show shortcuts next to commands.
- Filter current board/backlog.
- Reuse recent searches and saved filters.

## Navigation Model

The app should use lazy-family muscle memory, adapted to Jira's board and backlog screens.

| Key | Meaning |
|---|---|
| `?` | Help for current context |
| `/` | Search or filter current screen |
| `q` | Back, close, or quit depending on context |
| `Esc` | Cancel modal/search/selection |
| `Tab` / `Shift-Tab` | Cycle focus between major regions |
| `h` / `l` | Move between panes or board columns |
| `j` / `k` | Move through cards, rows, options, or document lines |
| `g` / `G` | Jump to top/bottom |
| `Ctrl-u` / `Ctrl-d` | Half-page up/down |
| `Enter` | Open or confirm |
| `Space` | Select/toggle for bulk work |
| `r` | Refresh current screen |
| `R` | Refresh all visible data |
| `s` | Status/transition |
| `a` | Assign |
| `p` | Priority |
| `c` | Comment |
| `e` | Edit focused field/content |
| `m` | Move issue to sprint/backlog/column when applicable |
| `J` / `K` | Rank backlog item down/up |
| `o` | Open in browser |
| `y` | Copy issue key/link |

Shortcuts should be generated into help and command surfaces so users can discover them from inside the app.

## Product Path

Implementation planning artifacts live under `docs/`:

- `docs/BUILD_PLAN.md`: phased build plan and parallel workstreams.
- `docs/TASK_TRACKER.md`: checklist for subagent coordination.
- `docs/OPENTUI_REFERENCE.md`: OpenTUI and OpenCode implementation references.
- `docs/subagents/`: task briefs that can be assigned to parallel implementers.

## Development

- `bun install`: install dependencies.
- `bun run dev`: run the TUI in watch mode.
- `bun run start`: run the TUI once.
- `bun run typecheck`: validate TypeScript.
- `bun test`: run tests.

### Phase 1: Demo Board Foundation

Goal: prove the main experience without depending on real Jira data.

- Workspace sidebar.
- Active sprint board with columns and cards.
- Backlog with active/future/backlog sections.
- Inspector for selected issue.
- Detail drawer/overlay for one issue.
- Help surface and command palette.
- Keyboard navigation across board columns, backlog rows, and detail content.

Success criteria:

- The app feels useful with mock data.
- A user can understand sprint state at a glance.
- A user can navigate entirely by keyboard.
- A user can open details without losing board/backlog context.

### Phase 2: Read-Only Jira Workspace

Goal: load real Jira overview data safely.

- Projects and boards.
- Board columns/statuses.
- Active sprint issues.
- Backlog issues.
- Future sprints.
- Issue detail.
- Comments, links, subtasks, attachments, and activity.
- Saved filters and quick filters.

Success criteria:

- The terminal can replace the web UI for checking active sprint and backlog state.
- Refreshing data is explicit and reliable.
- Errors are visible and actionable.

### Phase 3: Safe Daily Actions

Goal: perform common Jira updates faster than the web UI.

- Transition status.
- Assign/reassign.
- Change priority.
- Add/edit comment.
- Edit summary/description.
- Move issue into sprint or backlog.
- Rank issue in backlog.
- Copy/open issue links.

Success criteria:

- Common actions take one or two keystrokes after selection.
- High-impact writes show confirmation with exact issue key and target change.
- Failed writes keep the user in context and show the Jira reason.

### Phase 4: Planning And Triage Power Tools

Goal: make sprint planning and triage better than the web UI for keyboard users.

- Bulk selection.
- Bulk assign/transition/priority.
- Blocked/stale/unassigned views.
- Epic and assignee swimlanes.
- Sprint capacity indicators.
- Recently changed issue feed.
- Personal work queue.
- Saved workspace layouts.

Success criteria:

- A user can groom a backlog without switching to the browser.
- A user can run a sprint triage session from the terminal.
- The app makes risky changes obvious before applying them.

### Phase 5: Rich Docs And Knowledge Context

Goal: make issue reading and linked documentation comfortable.

- Rich issue descriptions.
- Confluence/doc links opened inside the terminal.
- Code blocks, tables, checklists, links, and quotes displayed cleanly.
- Related docs shown next to issue context.
- Search across issues and docs.

Success criteria:

- Users can understand issue context without opening the browser.
- Linked docs are readable enough for daily engineering work.

## What We Are Not Building First

- A clone of every Jira administration screen.
- A terminal replacement for all Jira configuration.
- A document reader that ignores board/backlog workflow.
- A table-only issue browser with no sprint/backlog awareness.

## Open Product Decisions

- Default landing screen: Active Sprint, Backlog, or Workspace Home.
- How much of the inspector should always be visible on narrow terminals.
- Whether issue detail opens as a right drawer, overlay, or full-screen route by default.
- How to represent swimlanes without making the board visually noisy.
- Which bulk operations are safe enough for early versions.
- How aggressively to mirror Jira web behavior versus designing terminal-native flows.
