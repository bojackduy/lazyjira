# Subagent Task: Active Sprint Board

## Objective

Build the active sprint board screen: columns, cards, selection, sprint health, quick filters, and inspector coordination.

## Parallel Status

Can start once demo board data and navigation command names exist. It can be developed with mock state before real Jira APIs are ready.

## Inputs

- Product screen spec: `README.md` Active Sprint Board section.
- Domain/demo data from `02-domain-demo-data`.
- Command names from `03-keymap-command-system`.
- OpenTUI layout notes: `docs/OPENTUI_REFERENCE.md`.

## Suggested Scope

- Render board columns by workflow status.
- Render issue cards with key, summary, type, priority, assignee, blocked/stale flags, and epic/label hints.
- Support selection across columns and within columns.
- Keep per-column selection/scroll state.
- Update inspector when selected issue changes.
- Show sprint health summary either in inspector or board header.
- Add quick filter display and filter state hooks.

## Suggested Files

- `src/routes/active-sprint.tsx`
- `src/ui/board/board.tsx`
- `src/ui/board/column.tsx`
- `src/ui/board/card.tsx`
- `src/ui/board/sprint-health.tsx`
- `src/state/board-navigation.ts`

## OpenTUI References

- Use `box` with row layout for columns.
- Use `scrollbox` for board or column overflow.
- Use theme tokens for selected cards and status colors.
- Review OpenCode layout style in `/Users/duytrinh/Code/opencode/packages/tui/src/routes/session/index.tsx`.

## Checklist

- [ ] Board renders at least four demo columns.
- [ ] Cards are readable and visually scannable.
- [ ] `j/k` moves selected card within current column.
- [ ] `h/l` moves selected column while preserving per-column card position.
- [ ] `g/G` jumps within current column.
- [ ] `Ctrl-u/d` scrolls current column or board area.
- [ ] Selected card is obvious.
- [ ] Empty columns render intentionally.
- [ ] Narrow layout does not break columns; it stacks, horizontal-scrolls, or uses a focused-column mode.
- [ ] No API calls happen from board rendering components.

## Handoff

Return component names, board navigation state shape, and any assumptions about column sizing.

## Avoid

- Do not make the board a simple table.
- Do not hide blocked/stale/unassigned signals in detail only.
- Do not make every column independently fetch data.
