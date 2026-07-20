# OpenTUI Reference Notes

This project should lean on OpenTUI's strengths instead of reimplementing terminal UI primitives.

## OpenTUI Docs To Consult

- Getting started: `https://opentui.com/docs/getting-started`
- Solid binding: `https://opentui.com/docs/bindings/solid`
- Layout system: `https://opentui.com/docs/core-concepts/layout`
- Keymap: `https://opentui.com/docs/keymap/overview`
- Keyboard input: `https://opentui.com/docs/core-concepts/keyboard`
- Testing: `https://opentui.com/docs/core-concepts/testing`
- Markdown: `https://opentui.com/docs/components/markdown`
- Code: `https://opentui.com/docs/components/code`
- Diff: `https://opentui.com/docs/components/diff`
- ScrollBox: `https://opentui.com/docs/components/scrollbox`
- Select: `https://opentui.com/docs/components/select`
- TabSelect: `https://opentui.com/docs/components/tab-select`

Local skill docs are also available under:

- `/Users/duytrinh/.agents/skills/opentui/docs/`

## OpenCode Reference Paths

OpenCode is the best local reference for polished OpenTUI usage.

- App/renderer setup: `/Users/duytrinh/Code/opencode/packages/tui/src/app.tsx`
- Keymap/mode stack: `/Users/duytrinh/Code/opencode/packages/tui/src/keymap.tsx`
- Keybind config: `/Users/duytrinh/Code/opencode/packages/tui/src/config/keybind.ts`
- Theme system: `/Users/duytrinh/Code/opencode/packages/tui/src/theme/index.ts`
- Command palette: `/Users/duytrinh/Code/opencode/packages/tui/src/component/command-palette.tsx`
- Fuzzy select dialog: `/Users/duytrinh/Code/opencode/packages/tui/src/ui/dialog-select.tsx`
- Help dialog: `/Users/duytrinh/Code/opencode/packages/tui/src/ui/dialog-help.tsx`
- Session layout and scrollbox usage: `/Users/duytrinh/Code/opencode/packages/tui/src/routes/session/index.tsx`
- Sidebar pattern: `/Users/duytrinh/Code/opencode/packages/tui/src/routes/session/sidebar.tsx`
- Footer/status pattern: `/Users/duytrinh/Code/opencode/packages/tui/src/routes/session/footer.tsx`

## Patterns To Reuse

- Create a CLI renderer once at startup and pass it through providers.
- Use Solid context providers for config, theme, route, data, dialog, toast, and keymap.
- Use OpenTUI keymap layers instead of ad hoc key listeners.
- Model app modes explicitly: base, board, backlog, detail, dialog, search, command palette.
- Generate command palette entries from registered command metadata.
- Generate help from active bindings where practical.
- Use `scrollbox` for board/detail panes that need independent scrolling.
- Use `markdown` for issue descriptions and linked docs.
- Use `code` or markdown fenced-code rendering for snippets.
- Use a real theme token system: text, muted text, background, panel background, border, active border, success, warning, error, selected item, markdown, syntax, diff.

## OpenTUI Features To Use Intentionally

- Solid JSX intrinsic elements: `box`, `text`, `scrollbox`, `input`, `textarea`, `select`, `tab_select`, `markdown`, `code`, `diff`.
- Yoga/flex layout for wide and narrow responsive layouts.
- `useTerminalDimensions` for responsive decisions.
- `Portal` for dialogs and overlays.
- `testRender` for render tests.
- OpenTUI keymap `getCommandEntries`, `getCommandBindings`, and active-key queries for help and palette surfaces.
- Markdown `tableOptions` for Jira/Confluence tables.
- Markdown `conceal` for readable rich descriptions.
- Markdown `internalBlockMode="top-level"` when a detail reader benefits from stable block rendering.

## Implementation Warnings

- Do not build a custom markdown renderer before trying OpenTUI `markdown`.
- Do not hardcode shortcut text into the UI if it can come from the keymap.
- Do not couple Jira API calls to components; use services/effects/stores.
- Do not make the issue detail reader the default landing surface.
- Do not let direct focus shortcuts steal `j/k/h/l` navigation.
- Do not design only for wide terminals; narrow layout behavior is part of the product.
