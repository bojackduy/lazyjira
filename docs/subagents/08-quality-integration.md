# Subagent Task: Quality And Integration

## Objective

Keep parallel work integrated, testable, and aligned with the product direction.

## Parallel Status

Can start after foundation, then continue throughout all waves.

## Inputs

- `docs/BUILD_PLAN.md`
- `docs/TASK_TRACKER.md`
- All subagent handoffs.
- OpenTUI testing docs: `/Users/duytrinh/.agents/skills/opentui/docs/core-concepts/testing.mdx`.
- Solid test reference: `/Users/duytrinh/.agents/skills/opentui/docs/bindings/solid.mdx`.

## Suggested Scope

- Add render tests for shell, board, backlog, inspector, and detail.
- Add keymap tests for mode-specific shortcuts.
- Add state/selector tests for sprint health and selection.
- Add fixtures for loading, empty, and error states.
- Add narrow-terminal verification.
- Keep task tracker updated as work completes.

## Suggested Files

- `src/**/*.test.ts`
- `src/**/*.test.tsx`
- `test/fixtures/`
- `test/render/`
- `docs/MANUAL_TESTING.md`

## Checklist

- [ ] Test command runs locally.
- [ ] Typecheck command runs locally.
- [ ] Shell render test exists.
- [ ] Active sprint board render/navigation tests exist.
- [ ] Backlog render/navigation tests exist.
- [ ] Inspector/detail render tests exist.
- [ ] Keymap mode tests exist.
- [ ] Narrow terminal tests or manual checklist exists.
- [ ] Loading, empty, and error states are covered.
- [ ] `docs/TASK_TRACKER.md` reflects current work status.

## Handoff

Return test commands, current pass/fail status, and any integration risks.

## Avoid

- Do not rewrite product code just to fit a test preference.
- Do not snapshot unstable data such as current time unless normalized.
- Do not skip manual keyboard smoke testing for board/backlog navigation.
