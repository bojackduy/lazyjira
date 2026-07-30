# Subagent Task: Foundation Shell

## Objective

Create the runnable app foundation that all other tracks can build on.

## Parallel Status

Start first. Most other implementation work depends on this task defining the project skeleton, app entrypoint, and shared state/provider boundaries.

## Inputs

- Product direction: `README.md`.
- Engineering policy: `AGENTS.md`.
- Build plan: `docs/BUILD_PLAN.md`.
- OpenTUI references: `docs/OPENTUI_REFERENCE.md`.

## Suggested Scope

- Add package/runtime scaffolding.
- Add app entrypoint.
- Add root app shell.
- Add placeholder route/screen state for workspace, active sprint, backlog, board, issue detail, and the persistent issue inspector.
- Add provider placeholders for config, theme, keymap, data, dialog/toast, and routing.
- Add basic dev/typecheck/test commands.
- Add a demo mode path that does not require Jira credentials.

## Suggested Files

- `package.json`
- `tsconfig.json`
- `bunfig.toml`
- `src/main.tsx`
- `src/app.tsx`
- `src/context/`
- `src/state/`
- `src/ui/shell.tsx`
- `src/routes/`

## OpenTUI References

- `/Users/duytrinh/Code/opencode/packages/tui/src/app.tsx`
- `/Users/duytrinh/.agents/skills/opentui/docs/bindings/solid.mdx`
- `/Users/duytrinh/.agents/skills/opentui/docs/core-concepts/layout.mdx`

## Checklist

- [ ] App launches with demo mode and no credentials.
- [ ] App renders a workspace shell with sidebar, main surface, inspector area, and footer placeholders.
- [ ] Renderer lifecycle is clean: startup, exit, cleanup.
- [ ] Basic responsive layout exists for wide and narrow terminal sizes.
- [ ] Shared state shape has routes for `workspace`, `timeline`, `backlog`, `list`, `board`, and `issue-detail`, plus settings/internal routes and persistent inspector state.
- [ ] Test/typecheck/dev scripts are documented in `package.json`.
- [ ] No Jira API calls exist in rendering components.

## Handoff

Return the exact commands to run the app and verify the scaffold. List any state/provider names other agents must use.

## Avoid

- Do not implement real Jira API calls in this task.
- Do not spend time polishing final UI details.
- Do not build a custom keymap system if OpenTUI keymap is available.
