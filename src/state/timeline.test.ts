import { describe, expect, test } from "bun:test"
import type { IssueSummary } from "./app-state"
import { createInitialAppState } from "./initial"
import { projectListIssuePageSourceId } from "./issue-pages"
import { loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import {
  buildTimelineHierarchy,
  classifyTimelineIssue,
  cycleTimelineZoom,
  formatTimelineDate,
  panTimelineWindow,
  projectTimelineRows,
  timelineCells,
  timelineCreateRowKey,
  timelineDateBounds,
  timelineLayout,
  timelineNotices,
  timelineRowCopy,
  timelineSchedule,
  timelineScheduleText,
  timelineSelection,
  timelineStateText,
  timelineTodayWindow,
  timelineWindowEnd,
} from "./timeline"

describe("timeline data model", () => {
  test("builds arbitrary-depth hierarchy in stable project order", () => {
    const issues = issueMap([
      issue("ROOT", { startDate: "2026-08-01", dueDate: "2026-09-01" }),
      issue("CHILD", { parentKey: "ROOT", startDate: "2026-08-03" }),
      issue("LEAF", { parentKey: "CHILD", dueDate: "2026-08-20" }),
      issue("OTHER"),
    ])
    const model = buildTimelineHierarchy(issues, ["CHILD", "OTHER", "LEAF"], page(3, 3, true), { status: "available", fieldId: "customfield_start" })

    expect(model.rows.map((row) => [row.issue.key, row.depth, row.classification])).toEqual([
      ["ROOT", 0, "scheduled"],
      ["CHILD", 1, "start-only"],
      ["LEAF", 2, "due-only"],
      ["OTHER", 0, "unscheduled"],
    ])
    expect(timelineDateBounds(model.rows)).toEqual({ start: "2026-08-01", end: "2026-09-01" })
  })

  test("groups missing parents and protects cycles and their descendants", () => {
    const issues = issueMap([
      issue("MISSING", { parentKey: "NOT-LOADED", dueDate: "2026-08-10" }),
      issue("MISSING-CHILD", { parentKey: "MISSING" }),
      issue("A", { parentKey: "B", startDate: "2026-08-01", dueDate: "2026-08-02" }),
      issue("B", { parentKey: "A" }),
      issue("C", { parentKey: "A" }),
    ])
    const model = buildTimelineHierarchy(issues, ["MISSING", "MISSING-CHILD", "A", "B", "C"], page(5, 5, true))

    expect(model.rows.map((row) => [row.issue.key, row.group, row.depth, row.classification])).toEqual([
      ["MISSING", "missing-parent", 0, "missing-parent"],
      ["MISSING-CHILD", "missing-parent", 1, "missing-parent"],
      ["A", "invalid-hierarchy", 0, "invalid-hierarchy"],
      ["B", "invalid-hierarchy", 0, "invalid-hierarchy"],
      ["C", "invalid-hierarchy", 0, "invalid-hierarchy"],
    ])
  })

  test("classifies only valid explicit Jira dates and reports partial completeness", () => {
    expect(classifyTimelineIssue({ startDate: "2026-02-30", dueDate: "2026-08-01" })).toBe("due-only")
    expect(classifyTimelineIssue({ startDate: undefined, dueDate: undefined })).toBe("unscheduled")
    const model = buildTimelineHierarchy(issueMap([issue("ONE")]), ["ONE"], page(1, 10, false), { status: "unavailable", reason: "ambiguous", candidateIds: ["a", "b"] }, "Parent hydration failed: Jira 403")
    expect(model).toMatchObject({ loaded: 1, total: 10, partial: true, startDateField: { status: "unavailable", reason: "ambiguous" }, parentHydrationError: "Parent hydration failed: Jira 403" })
    expect(timelineDateBounds(model.rows)).toBeUndefined()
  })

  test("projects collapsed parents without mutating hierarchy rows and keeps selection bounded", () => {
    const model = buildTimelineHierarchy(issueMap([
      issue("ROOT"),
      issue("CHILD", { parentKey: "ROOT" }),
      issue("LEAF", { parentKey: "CHILD" }),
      issue("OTHER"),
    ]), ["ROOT", "CHILD", "LEAF", "OTHER"], page(4, 4, true))

    const projected = projectTimelineRows(model.rows, ["ROOT"])

    expect(projected.map((row) => [row.issue.key, row.hasChildren, row.collapsed])).toEqual([
      ["ROOT", true, true],
      ["OTHER", false, false],
    ])
    expect(model.rows.map((row) => row.issue.key)).toEqual(["ROOT", "CHILD", "LEAF", "OTHER"])
    expect(timelineSelection(projected, "ROOT", 1)).toBe("OTHER")
    expect(timelineSelection(projected, "OTHER", 1)).toBe(timelineCreateRowKey)
    expect(timelineSelection(projected, timelineCreateRowKey, 1)).toBe(timelineCreateRowKey)
    expect(timelineSelection(projected, "OTHER", "first")).toBe("ROOT")
    expect(timelineSelection(projected, "ROOT", "last")).toBe(timelineCreateRowKey)
    expect(timelineSelection([], undefined, "first")).toBe(timelineCreateRowKey)
  })

  test("uses deterministic UTC zoom, pan, today, and inclusive window math", () => {
    expect(cycleTimelineZoom("day")).toBe("week")
    expect(cycleTimelineZoom("week")).toBe("month")
    expect(cycleTimelineZoom("month")).toBe("day")
    expect(timelineTodayWindow("2026-07-30", "week")).toBe("2026-07-27")
    expect(timelineTodayWindow("2026-07-30", "month")).toBe("2026-07-01")
    expect(panTimelineWindow("2026-07-30", "day", 1)).toBe("2026-07-31")
    expect(panTimelineWindow("2026-07-30", "week", -1)).toBe("2026-07-20")
    expect(panTimelineWindow("2026-01-15", "month", -1)).toBe("2025-12-01")
    expect(timelineWindowEnd("2026-07-30", "week", 4)).toBe("2026-08-23")
    expect(formatTimelineDate("2026-08-03")).toBe("Aug 03")
  })

  test("builds bounded date cells with explicit today semantics", () => {
    const cells = timelineCells("2026-07-30", "week", 4, "2026-08-03")
    expect(cells).toEqual([
      { start: "2026-07-27", end: "2026-08-02", label: "07/27", today: false },
      { start: "2026-08-03", end: "2026-08-09", label: "08/03", today: true },
      { start: "2026-08-10", end: "2026-08-16", label: "08/10", today: false },
      { start: "2026-08-17", end: "2026-08-23", label: "08/17", today: false },
    ])
  })

  test("renders inclusive bars, labeled one-date markers, unscheduled, and invalid ranges", () => {
    const cells = timelineCells("2026-08-03", "day", 5, "2026-08-03")
    expect(timelineSchedule({ startDate: "2026-08-03", dueDate: "2026-08-05" }, cells)).toEqual({ kind: "bar", cells: ["bar", "bar", "bar", "empty", "empty"], text: "Aug 03 -> Aug 05" })
    expect(timelineSchedule({ startDate: "2026-08-04" }, cells)).toEqual({ kind: "marker", cells: ["empty", "marker", "empty", "empty", "empty"], text: "Start Aug 04 only" })
    expect(timelineSchedule({ dueDate: "2026-08-05" }, cells)).toEqual({ kind: "marker", cells: ["empty", "empty", "marker", "empty", "empty"], text: "Due Aug 05 only" })
    expect(timelineSchedule({ startDate: "2026-07-01", dueDate: "2026-07-10" }, cells)).toEqual({ kind: "bar", cells: ["before", "empty", "empty", "empty", "empty"], text: "Jul 01 -> Jul 10" })
    expect(timelineSchedule({ dueDate: "2026-09-01" }, cells)).toEqual({ kind: "marker", cells: ["empty", "empty", "empty", "empty", "after"], text: "Due Sep 01 only" })
    expect(timelineSchedule({}, cells)).toEqual({ kind: "text", text: "unscheduled" })
    expect(timelineSchedule({}, cells, { id: "sprint-1", name: "Sprint 1", goal: "", state: "active", startDate: "2026-08-03T00:00:00.000Z", endDate: "2026-08-05T00:00:00.000Z" })).toEqual({ kind: "sprint", cells: ["sprint", "sprint", "sprint", "empty", "empty"], text: "Sprint 1 window Aug 03 -> Aug 05" })
    expect(timelineSchedule({ startDate: "2026-08-06", dueDate: "2026-08-05" }, cells)).toEqual({ kind: "text", text: "invalid range · Start Aug 06 · Due Aug 05" })
  })

  test("uses a textual narrow fallback until identity plus seven cells fit", () => {
    expect(timelineLayout(80, "day")).toMatchObject({ wide: true, viewportWidth: 76, cellWidth: 2 })
    expect(timelineLayout(120, "week")).toMatchObject({ wide: false, viewportWidth: 50, cellWidth: 5 })
    expect(timelineLayout(160, "week").wide).toBe(true)
    expect(timelineLayout(200, "month").wide).toBe(true)
  })

  test("provides explicit copy for every hierarchy and schedule classification", () => {
    expect(timelineScheduleText({ startDate: "2026-08-01", dueDate: "2026-08-02" })).toBe("Aug 01 -> Aug 02")
    expect(timelineScheduleText({ startDate: "2026-08-01" })).toBe("Start Aug 01 only")
    expect(timelineScheduleText({ dueDate: "2026-08-02" })).toBe("Due Aug 02 only")
    expect(timelineScheduleText({})).toBe("unscheduled")
    expect(timelineRowCopy({ issue: issue("MISSING", { parentKey: "NOPE", dueDate: "2026-08-02" }), depth: 0, group: "missing-parent", classification: "missing-parent" })).toBe("parent not loaded: NOPE · Due Aug 02 only")
    expect(timelineRowCopy({ issue: issue("CYCLE"), depth: 0, group: "invalid-hierarchy", classification: "invalid-hierarchy" })).toBe("invalid hierarchy · unscheduled")
  })

  test("distinguishes loading, retained refresh, partial, filtered empty, permission, error, and empty states", () => {
    const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    state.route = "timeline"
    expect(timelineStateText(state)).toContain("Loading PROJ Timeline")

    state.issueKeysBySource[projectListIssuePageSourceId] = ["PROJ-300"]
    state.issuePageStateBySource[projectListIssuePageSourceId] = page(1, 10, false)
    expect(timelineStateText(state)).toBe("1/10 project issues loaded · partial · L load more")
    state.issuePageStateBySource[projectListIssuePageSourceId]!.loading = true
    expect(timelineStateText(state)).toBe("Loading more Timeline issues · 1/10 retained...")
    state.issuePageStateBySource[projectListIssuePageSourceId]!.loading = false
    state.issuePageStateBySource[projectListIssuePageSourceId]!.refreshing = true
    expect(timelineStateText(state)).toBe("Refreshing Timeline · 1/10 retained...")
    state.issuePageStateBySource[projectListIssuePageSourceId]!.refreshing = false
    state.searchQuery = "nothing-matches"
    expect(timelineStateText(state)).toContain("No loaded Timeline issues match")
    state.searchQuery = ""
    state.issuePageStateBySource[projectListIssuePageSourceId]!.error = "Jira 429: Retry later"
    expect(timelineStateText(state)).toContain("1 rows retained · L retry")

    state.issueKeysBySource[projectListIssuePageSourceId] = []
    state.issuePageStateBySource[projectListIssuePageSourceId] = { ...page(0, 0, false), error: "Jira 403: No access" }
    expect(timelineStateText(state)).toContain("requires Browse Projects and issue access")
    state.issuePageStateBySource[projectListIssuePageSourceId] = { ...page(0, 0, false), error: "Jira 500" }
    expect(timelineStateText(state)).toContain("Timeline for PROJ failed")
    state.issuePageStateBySource[projectListIssuePageSourceId] = page(0, 0, true)
    expect(timelineStateText(state)).toBe("Jira returned no issues for project PROJ.")
  })

  test("reports missing Start date and parent hydration as nonfatal notices", () => {
    const model = buildTimelineHierarchy(issueMap([issue("ONE", { dueDate: "2026-08-02" })]), ["ONE"], page(1, 1, true), { status: "unavailable", reason: "ambiguous", candidateIds: ["a", "b"] }, "Jira 403")
    expect(timelineNotices(model)).toEqual([
      "Start date unavailable: multiple Jira date fields matched; showing Due-only, sprint-window, and unscheduled rows.",
      "Parent hydration incomplete: Jira 403",
    ])
  })
})

function issue(key: string, values: Partial<IssueSummary> = {}): IssueSummary {
  return {
    key,
    title: key,
    type: "Task",
    priority: "Medium",
    statusId: "todo",
    assignee: "Duy",
    reporter: "Mina",
    labels: [],
    components: [],
    blocked: false,
    staleDays: 0,
    description: "",
    comments: [],
    links: [],
    ...values,
  }
}

function issueMap(issues: IssueSummary[]) {
  return Object.fromEntries(issues.map((candidate) => [candidate.key, candidate]))
}

function page(startAt: number, total: number, isLast: boolean) {
  return { sourceId: "project-list", startAt, maxResults: 50, total, isLast, loading: false }
}
