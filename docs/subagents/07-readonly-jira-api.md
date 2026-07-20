# Subagent Task: Read-Only Jira API

## Objective

Add real read-only Jira loading behind the existing demo-state screens.

## Parallel Status

Can start after the domain model stabilizes. It should not block demo UI work.

## Inputs

- Domain model from `02-domain-demo-data`.
- Product scope from `README.md` Phase 2.
- Reference implementations: `lazyjira/pkg/jira` and `jiratui/src/jiratui/api_controller`.

## Suggested Scope

- Add API client interface.
- Add auth/config reading stub or adapter, but keep demo mode credential-free.
- Add Jira Agile reads for boards, board config/statuses, sprints, active sprint issues, and backlog issues.
- Add Jira issue detail read.
- Normalize raw Jira responses into domain models.
- Map errors into user-facing categories.

## Suggested Files

- `src/services/jira/client.ts`
- `src/services/jira/endpoints.ts`
- `src/services/jira/normalize.ts`
- `src/services/jira/errors.ts`
- `src/services/jira/types.ts`
- `src/store/workspace-loader.ts`
- `src/store/issue-loader.ts`

## Read-Only Endpoint Priorities

- Projects and boards.
- Board configuration and statuses.
- Active and future sprints.
- Active sprint issues.
- Backlog issues.
- Issue detail.
- Comments, links, subtasks, attachments, and activity where feasible.

## Checklist

- [ ] API layer is separate from UI components.
- [ ] Demo mode still runs without credentials.
- [ ] Real loading can populate the same state used by demo screens.
- [ ] Network/auth/permission/not-found/rate-limit/invalid-response errors map to actionable messages.
- [ ] Stale response protection exists for issue detail loading.
- [ ] Tests cover normalization with fixture responses.

## Handoff

Return API client interface, loader entrypoints, required config keys, and known Jira Cloud/Data Center differences.

## Avoid

- Do not implement writes in this task.
- Do not let raw Jira DTOs leak into route components.
- Do not remove or degrade demo mode.
