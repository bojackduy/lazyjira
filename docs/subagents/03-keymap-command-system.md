# Subagent Task: Keymap And Command System

## Objective

Build the lazy-family keyboard model, command registry, help metadata, and command palette foundations.

## Parallel Status

Can start after foundation provides renderer/keymap providers. Should coordinate command names with board, backlog, detail, and API agents.

## Inputs

- Keybinding policy: `README.md` and `AGENTS.md`.
- OpenTUI notes: `docs/OPENTUI_REFERENCE.md`.
- OpenCode keymap reference: `/Users/duytrinh/Code/opencode/packages/tui/src/keymap.tsx`.
- OpenCode command palette reference: `/Users/duytrinh/Code/opencode/packages/tui/src/component/command-palette.tsx`.

## Suggested Scope

- Register app keymap layers and named commands.
- Define app modes: base, workspace, board, backlog, detail, dialog, search, command-palette.
- Add lazy-family default bindings.
- Add command metadata: title, description, category, visibility, suggested status.
- Add help/query utilities based on active bindings.
- Add a command palette UI or command palette data provider.

## Suggested Files

- `src/keymap/register.ts`
- `src/keymap/defaults.ts`
- `src/keymap/commands.ts`
- `src/keymap/modes.ts`
- `src/ui/command-palette.tsx`
- `src/ui/help.tsx`
- `src/context/keymap.tsx`

## Required Default Commands

- `app.quit`
- `help.show`
- `search.open`
- `refresh.current`
- `refresh.all`
- `focus.next`
- `focus.previous`
- `nav.up`
- `nav.down`
- `nav.left`
- `nav.right`
- `nav.top`
- `nav.bottom`
- `nav.half_up`
- `nav.half_down`
- `issue.open`
- `issue.transition`
- `issue.assign`
- `issue.priority`
- `issue.comment`
- `issue.edit`
- `issue.move`
- `issue.copy_link`
- `issue.open_browser`
- `backlog.rank_up`
- `backlog.rank_down`

## Checklist

- [ ] `j/k/h/l` are reserved for movement/focus, not direct widget jumps.
- [ ] `?`, `/`, `q`, `Esc`, `Tab`, `Enter`, `Space`, `g/G`, `Ctrl-u/d` are registered.
- [ ] Board mode maps `h/l` to columns and `j/k` to cards.
- [ ] Backlog mode maps `j/k` to rows and `J/K` to rank movement.
- [ ] Detail mode maps `j/k` and `Ctrl-u/d` to document scrolling.
- [ ] Dialog mode handles `Esc`, `Enter`, `j/k`, `/` where appropriate.
- [ ] Help and command palette can show active shortcuts from metadata.
- [ ] Keymap tests cover mode-specific behavior.

## Handoff

Return command names and mode names. Other agents should use these names instead of inventing their own.

## Avoid

- Do not hardcode shortcut labels in screen components.
- Do not let text inputs consume global commands when focused.
- Do not add one-off component key handlers if a named command can express the action.
