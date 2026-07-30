import { describe, expect, test } from "bun:test"
import type { IssueSummary } from "./app-state"
import { buildTimelineHierarchy, classifyTimelineIssue, timelineDateBounds } from "./timeline"

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
