# Subagent Task: Domain And Demo Data

## Objective

Define the shared Jira workspace domain model and provide rich demo data for all screens.

## Parallel Status

Can start after the foundation shell defines where model and state files live. Board, backlog, inspector, and detail work depend on this.

## Inputs

- Product direction: `README.md`.
- Build plan: `docs/BUILD_PLAN.md`.
- Foundation handoff from `01-foundation-shell`.

## Suggested Scope

- Define normalized domain types for workspace overview, project, board, sprint, status, issue card, issue detail, comment, link, attachment, and quick filter.
- Define screen state for active sprint board, backlog, Kanban board, inspector, and issue detail.
- Provide demo fixtures with enough variety to exercise UI states.
- Add selectors for sprint health, stale issues, unassigned issues, blocked issues, selected issue, board columns, backlog sections, and issue counts.

## Suggested Files

- `src/model/project.ts`
- `src/model/board.ts`
- `src/model/sprint.ts`
- `src/model/issue.ts`
- `src/model/document.ts`
- `src/state/workspace.ts`
- `src/state/selectors.ts`
- `src/demo/workspace.ts`
- `src/demo/issues.ts`

## Demo Data Requirements

- At least one project with two boards.
- One active sprint with multiple statuses.
- At least four board columns.
- At least twelve issue cards across columns.
- Future sprint sections.
- Backlog section with rankable items.
- Blocked, stale, unassigned, high-priority, and current-user-assigned issues.
- Issue detail with rich markdown description, comments, links, subtasks, and activity.

## Checklist

- [ ] Types are UI-friendly and not raw Jira DTOs.
- [ ] Demo data supports Active Sprint, Backlog, Kanban, Workspace Home, Inspector, and Detail.
- [ ] Selectors are pure and testable.
- [ ] Sprint health can be computed from demo data.
- [ ] Selected issue can be resolved from any route.
- [ ] Empty/loading/error state fixtures are available.

## Handoff

Return the model names, selector names, and demo fixture entrypoints other agents should import.

## Avoid

- Do not model every Jira field upfront.
- Do not leak raw REST response shapes into UI state.
- Do not add real API fetching in this task.
