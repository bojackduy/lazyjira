# Jira Project Navigation Smoke Checklist

Run these checks manually only against disposable Scrum and Kanban projects on a non-production Jira Cloud site. Record the site, project key, board ID, tester, date, terminal size, and any Jira permissions or field mappings that affect the result. Do not treat dev fixtures or automated tests as evidence that this checklist passed.

Before starting:

- Use projects with enough issues to require at least two Project List pages and, where available, at least two Backlog or Kanban board pages.
- Include scheduled, one-date, unscheduled, parented, and missing-parent-visible issues where the Jira project permits them.
- Create or identify one disposable issue suitable for staged field/comment changes; use `docs/JIRA_WRITE_SMOKE_CHECKLIST.md` for destructive write coverage.
- Start with no local filter or remote search active and note the initial issue keys visible in each source.

## Scrum Project

- [ ] Select a Scrum project and board through `P`; confirm the sidebar shows `Global > Workspace` and `Project > Timeline, Backlog, List, Active sprints`, with no separate Kanban or Config project destination.
- [ ] Press `2` for Timeline; confirm project identity, loaded/total completeness, date window, and zoom are visible.
- [ ] In Timeline, verify colored scheduled lines or exact narrow-layout dates match Jira Start/Due fields, one-date rows identify which date exists, and dated sprint fallback lines remain visually distinct from issue dates.
- [ ] Verify hierarchy indentation against Jira parents. Confirm missing-parent hydration/notice and invalid-hierarchy notice behavior when corresponding data exists; record `not represented in test data` rather than passing an untested notice.
- [ ] Use `Space`, `h/l`, `[/]`, `z`, and `t`; confirm collapse and date-window state survive opening an issue with `Enter` and returning with `Esc`.
- [ ] Apply `/` to Timeline and confirm only loaded rows change. Clear it, press `S`, and confirm remote results do not replace Timeline membership or its paging cursor.
- [ ] Press `L` in Timeline when another project page exists; confirm loaded count increases, existing rows dedupe, selection remains stable, and Backlog/Active sprints membership does not change.
- [ ] Press `3` for Backlog; confirm active, future, and backlog groups are present as Jira data permits, groups collapse with `Space`, empty planning groups remain focusable, and normal Story parents do not render as top-level parent badges.
- [ ] Verify `h/l`, `j/k`, `g/G`, `Ctrl-u/d`, and focused `L` paging. Leave Backlog, change selection in another project tab, return, and confirm focus/cursor movement works before another load. Confirm loading another Backlog/future-sprint page does not add issues to List or Timeline until their own project page is loaded.
- [ ] Press `4` for List; confirm it represents project-wide issues rather than only the active sprint/backlog cache, and Key/Summary remain visible at a narrow terminal width.
- [ ] Verify List `j/k`, `g/G`, `Ctrl-u/d`, `h/l`, independent `Space` hierarchy collapse, `/`, clear-filter behavior, and `L` paging. Confirm `S` remote search remains isolated from List membership and cursor state.
- [ ] Open detail from Timeline, Backlog, List, and Active sprints, then return with `Esc`; confirm each originating row/card, group/column, Timeline window, and List horizontal offset are preserved.
- [ ] Press `5` for Active sprints; confirm sprint name, dates, goal, complete active-sprint issue set, status columns, create cards, and no Kanban `L` paging claim.
- [ ] Apply and clear a quick filter from the sidebar on every project view; confirm it filters loaded data only and preserves the selected issue when still visible.
- [ ] Stage a reversible field or comment change from a project view. Confirm the `Pending` count updates, `w` renders only the local overlay, `W` shows exact planned/blocked Jira operations, and `Esc` closes review without applying or clearing the stage.
- [ ] If remote apply is approved for this smoke run, apply only the disposable change, verify Jira, and confirm an induced failure remains staged while a successful neighboring operation clears.

## Kanban Project

- [ ] Select a Kanban project and board through `P`; confirm the sidebar shows `Global > Workspace` and `Project > Timeline, Backlog, List, Board`, with no Active sprints or Config project destination.
- [ ] Press `2` for Timeline; confirm project identity, loaded/total completeness, date window, zoom, hierarchy, and scheduled/one-date/unscheduled rows use Jira data exactly as in the Scrum checks.
- [ ] Verify missing Start field, unresolved parent, or invalid hierarchy notices when corresponding data exists; record `not represented in test data` for scenarios not exercised.
- [ ] Exercise Timeline collapse, pan, zoom, today, loaded filter, `L` paging, detail open/return, and narrow textual dates. Confirm none of these changes Board, Backlog, remote-search, or List source membership.
- [ ] Press `3` for Backlog. If Jira exposes a Kanban backlog, confirm one non-sprint planning group, bounded paging, rank staging, and no sprint-only move/group copy.
- [ ] If Jira reports Kanban backlog unavailable or forbidden, confirm lazyjira shows an actionable unavailable/permission state without inventing sprint groups; record the endpoint response and continue with List and Board checks.
- [ ] Press `4` for List; confirm project-wide scope, responsive Key/Summary columns, loaded filtering, independent `L` cursor, remote-search isolation, and detail return preserve selection and horizontal offset.
- [ ] Press `5` for Board; confirm board name, bounded loaded/total count, workflow columns, create cards, local filter behavior, and `L` load more when another board page exists.
- [ ] Load another Board page and confirm cards dedupe while Timeline/List and Kanban Backlog source memberships and cursors remain unchanged.
- [ ] Open detail from Timeline, Backlog when available, List, and Board, then return with `Esc`; confirm the originating row/card, column/group, Timeline window, and List offset are preserved.
- [ ] Apply and clear `/` plus a sidebar quick filter on each available project view; confirm both operate on loaded issues only. Confirm `S` results remain a separate source.
- [ ] Stage a reversible field or comment change. Confirm `Pending`, local `w` rendering, exact `W` planned/blocked rows, and closing review without apply all behave consistently across views.
- [ ] If remote apply is approved for this smoke run, apply only the disposable change, verify Jira, and confirm partial failure retention before cleanup.

## Record The Gap

For every unchecked item, record whether it was blocked by missing Jira data, permissions, an unavailable board capability, or an observed defect. A checklist with `not represented in test data` entries is partial and must not be reported as a complete Jira smoke pass.
