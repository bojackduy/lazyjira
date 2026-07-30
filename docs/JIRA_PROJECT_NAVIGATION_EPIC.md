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
  [ ] Only my issues
  [ ] Blocked
```

For a Kanban board, replace `Active sprints` with `Board`.

## Route Model

The target route model separates navigation concepts from renderer reuse:

- Global: `workspace`
- Project: `timeline`, `backlog`, `list`, `board`
- Internal: `issue-detail`
- Settings: configuration is excluded from normal sidebar routes

Migration may temporarily retain `active-sprint` and `kanban` aliases while persisted local workspace state and keymaps migrate. Remove aliases once state, tests, command palette, and docs consistently use `board`.

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

- `src/routes/active-sprint.tsx`
- `src/routes/kanban.tsx`
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
- Persisted route migration must be handled before removing `active-sprint` and `kanban` route IDs.
