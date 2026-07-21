# Subagent Task: Inspector And Issue Detail

## Objective

Build the selected issue inspector/editing surface and the full issue detail route used by board and backlog screens.

## Parallel Status

Can start after issue demo data exists. It can proceed independently from real Jira API work.

## Inputs

- Product screen spec: `README.md` Issue Detail And Inspector section.
- OpenTUI Markdown notes: `docs/OPENTUI_REFERENCE.md`.
- Domain/demo data from `02-domain-demo-data`.
- Command names from `03-keymap-command-system`.

## Suggested Scope

- Render persistent inspector for selected issue.
- Keep the right inspector pane as the quick issue/status/edit/create surface on overview routes.
- Render an issue detail route in the main pane while keeping the right inspector visible.
- Render markdown issue description.
- Render comments, subtasks, links, attachments, and activity sections.
- Add staged edit/create affordances plus transition, assign, priority, comment, copy, and open browser actions.
- Make status/type edits multiple-choice from current Jira/board metadata and keep their colors consistent with board/backlog views.
- Keep board/backlog context visible while using the inspector; restore it with `q`/Backspace from detail.

## Suggested Files

- `src/ui/issue-inspector.tsx`
- `src/routes/issue-detail.tsx`
- `src/state/issue-fields.ts`
- `src/ui/inspector/description.tsx`
- `src/ui/inspector/comments.tsx`
- `src/ui/inspector/links.tsx`
- `src/ui/inspector/activity.tsx`

## OpenTUI References

- Use `markdown` for issue descriptions and docs.
- Use `scrollbox` for detail content.
- Use markdown `tableOptions` for tables.
- Use `conceal` for readable descriptions.
- Review OpenCode markdown usage in `/Users/duytrinh/Code/opencode/packages/tui/src/routes/session/index.tsx` around `<markdown>`.

## Checklist

- [ ] Inspector updates when selected issue changes.
- [ ] `Enter` opens full issue detail from board and backlog selection.
- [ ] `q`/Backspace closes detail and returns to the previous overview.
- [ ] The right inspector pane remains visible on full issue detail.
- [ ] `e` or `Enter` edits the selected inspector field.
- [ ] Status and type inspector edits use colored multiple-choice pickers.
- [ ] `w` applies staged changes locally before Jira write integration exists.
- [ ] `x` discards the selected staged field.
- [ ] `n` creates a draft issue with context-aware defaults.
- [ ] Rich markdown description renders with headings, lists, code blocks, links, and tables.
- [ ] Comments and linked issue sections render from demo data.
- [ ] Inspector scroll behavior uses lazy-family keys.
- [ ] Empty description/comments/links states are handled.
- [ ] Narrow terminal inspector behavior is intentional.

## Handoff

Return detail route behavior, inspector field/edit behavior, and any state needed by board and backlog screens.

## Avoid

- Do not make issue detail the default landing screen.
- Do not build custom markdown rendering before using OpenTUI markdown.
- Do not put write flows directly inside display components.
