# Subagent Task: Inspector And Issue Detail

## Objective

Build the selected issue inspector and rich detail surface used by board and backlog screens.

## Parallel Status

Can start after issue demo data exists. It can proceed independently from real Jira API work.

## Inputs

- Product screen spec: `README.md` Issue Detail section.
- OpenTUI Markdown notes: `docs/OPENTUI_REFERENCE.md`.
- Domain/demo data from `02-domain-demo-data`.
- Command names from `03-keymap-command-system`.

## Suggested Scope

- Render persistent inspector for selected issue.
- Render detail drawer, overlay, or full-screen route based on available space.
- Render markdown issue description.
- Render comments, subtasks, links, attachments, and activity sections.
- Add action affordances for transition, assign, priority, comment, edit, copy, and open browser.
- Keep board/backlog context visible when detail is opened on wide screens.

## Suggested Files

- `src/ui/inspector.tsx`
- `src/routes/issue-detail.tsx`
- `src/ui/detail/detail-view.tsx`
- `src/ui/detail/description.tsx`
- `src/ui/detail/comments.tsx`
- `src/ui/detail/links.tsx`
- `src/ui/detail/activity.tsx`

## OpenTUI References

- Use `markdown` for issue descriptions and docs.
- Use `scrollbox` for detail content.
- Use markdown `tableOptions` for tables.
- Use `conceal` for readable descriptions.
- Review OpenCode markdown usage in `/Users/duytrinh/Code/opencode/packages/tui/src/routes/session/index.tsx` around `<markdown>`.

## Checklist

- [ ] Inspector updates when selected issue changes.
- [ ] Detail opens from board and backlog selection.
- [ ] `q` closes detail and returns to previous context.
- [ ] Rich markdown description renders with headings, lists, code blocks, links, and tables.
- [ ] Comments and linked issue sections render from demo data.
- [ ] Detail scroll behavior uses lazy-family keys.
- [ ] Empty description/comments/links states are handled.
- [ ] Narrow terminal detail behavior is intentional.

## Handoff

Return detail route/overlay behavior and any props/state needed by board and backlog screens.

## Avoid

- Do not make issue detail the default landing screen.
- Do not build custom markdown rendering before using OpenTUI markdown.
- Do not put write flows directly inside display components.
