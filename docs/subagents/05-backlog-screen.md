# Subagent Task: Backlog Screen

## Objective

Build the backlog planning screen: active sprint block, future sprint blocks, backlog block, ranking interaction, move-to-sprint action, and sprint health context.

## Parallel Status

Can start once demo backlog data and navigation command names exist. It can be developed independently from the active sprint board.

## Inputs

- Product screen spec: `README.md` Backlog section.
- Domain/demo data from `02-domain-demo-data`.
- Command names from `03-keymap-command-system`.

## Suggested Scope

- Render active sprint, future sprints, and backlog as distinct sections.
- Render compact issue rows optimized for grooming.
- Support row navigation across section boundaries.
- Add rank up/down behavior for demo data or rank preview state.
- Add move-to-sprint/backlog dialog trigger.
- Show sprint health and warnings from selectors.

## Suggested Files

- `src/routes/backlog.tsx`
- `src/ui/backlog/backlog.tsx`
- `src/ui/backlog/section.tsx`
- `src/ui/backlog/row.tsx`
- `src/ui/backlog/sprint-health.tsx`
- `src/state/backlog-navigation.ts`

## Checklist

- [ ] Active sprint section renders.
- [ ] Future sprint sections render.
- [ ] Backlog section renders.
- [ ] `j/k` moves through all visible rows.
- [ ] `g/G` jumps within current section or whole backlog, with behavior documented.
- [ ] `J/K` ranks item down/up in demo state or shows rank preview.
- [ ] `m` opens move dialog or dispatches move command stub.
- [ ] Sprint health panel shows counts and warnings.
- [ ] Empty sprint/backlog states are readable.
- [ ] Narrow layout remains usable.

## Handoff

Return the backlog selection model, rank behavior, and move dialog expectations.

## Avoid

- Do not implement real rank API writes in this task.
- Do not bury active sprint and future sprints behind tabs.
- Do not make grooming actions require mouse input.
