# Build Plan

## Goal

Build an overview-first Jira terminal workspace: active sprint board, backlog, Kanban board, issue inspector/editor, command palette, and lazy-family keyboard workflows.

The first executable milestone should use demo data. Real Jira API integration comes after the interaction model is working.

## Build Strategy

Build in waves so agents can work in parallel without blocking each other.

### Wave 0: Foundation

Foundation creates the project skeleton, app shell, shared state model, and basic testing commands. Most later tracks depend on this.

Outputs:

- Runnable TUI entrypoint.
- Shared app state shape.
- Demo data loader.
- Basic route/screen names.
- Test/typecheck commands documented.

Owner brief: `subagents/01-foundation-shell.md`.

### Wave 1: Parallel Product Surfaces

Once foundation exists, these can run mostly in parallel:

- Domain and demo data: `subagents/02-domain-demo-data.md`.
- Keymap and command palette: `subagents/03-keymap-command-system.md`.
- Active sprint board UI: `subagents/04-active-sprint-board.md`.
- Backlog UI: `subagents/05-backlog-screen.md`.
- Inspector and issue editing: `subagents/06-inspector-detail.md`.

Integration contract for Wave 1:

- Screens read from shared app state.
- Screens do not fetch Jira directly.
- Key handlers dispatch named commands, not component-local side effects where avoidable.
- Demo data must be stable and rich enough for screenshots and tests.

### Wave 2: Read-Only Jira Integration

Read-only Jira integration starts after demo screens prove the state shape.

Owner brief: `subagents/07-readonly-jira-api.md`.

Outputs:

- Project/board discovery.
- Active sprint loading.
- Backlog loading.
- Issue detail loading into the inspector.
- Clear API error mapping.
- Demo mode still works without credentials.

### Wave 3: Quality And Integration

Quality work can start during Wave 1 but should finish after Wave 2.

Owner brief: `subagents/08-quality-integration.md`.

Outputs:

- Snapshot or render tests for main screens.
- Keymap behavior tests.
- Narrow terminal layout checks.
- Error/loading/empty state checks.
- Manual verification checklist.

## Parallelization Map

| Workstream | Can Start | Depends On | Main Files/Areas |
|---|---|---|---|
| Foundation shell | Now | Product docs | package/app/config skeleton |
| Domain and demo data | After foundation shape agreed | Foundation shell | models, demo data, selectors |
| Keymap and commands | After renderer exists | Foundation shell | keymap, command registry, help |
| Active sprint board | After demo board data exists | Domain/demo data | board screen, cards, columns |
| Backlog screen | After demo backlog data exists | Domain/demo data | backlog sections, rank preview |
| Inspector/detail | After issue model exists | Domain/demo data | inspector, staged edits, markdown |
| Read-only Jira API | After domain model stabilizes | Domain/demo data | api client, normalization, effects |
| Quality integration | Any time after foundation | All tracks for final pass | tests, fixtures, docs |

## Integration Checkpoints

### Checkpoint A: Skeleton Runs

Pass when:

- App launches without Jira credentials.
- It renders a recognizable workspace shell.
- `q` exits or closes current surface.
- Typecheck/test command exists.

### Checkpoint B: Demo Board Is Useful

Pass when:

- Active sprint board shows multiple columns and cards.
- `j/k` moves within a column.
- `h/l` moves across columns.
- Inspector updates with selected card.
- `Enter` focuses the inspector and `e` edits the selected field.

### Checkpoint C: Backlog Is Useful

Pass when:

- Active sprint, future sprint, and backlog sections render.
- `j/k` moves through rows.
- `J/K` previews rank movement or updates demo ordering.
- `m` opens a move-to-sprint/backlog dialog.
- Sprint health panel updates from visible demo data.

### Checkpoint D: Read-Only Jira Works

Pass when:

- User can choose a project/board.
- Active sprint and backlog load from Jira.
- Issue detail loads from Jira into the inspector.
- Network/auth/Jira validation errors are actionable.
- Demo mode still works.

## Non-Negotiables

- Overview screens come before deep document reading.
- Active Sprint, Backlog, and Kanban Board are first-class routes.
- Rendering components must not call Jira directly.
- Keyboard behavior must preserve lazy/vim muscle memory.
- Help and command palette must derive from command/keymap metadata where practical.
- Narrow terminals must degrade intentionally, not break.
- Safe write flows must show exact issue key and target change before applying.
