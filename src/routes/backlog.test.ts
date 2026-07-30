import { describe, expect, test } from "bun:test"
import { backlogScrollTarget, backlogUsesCompactLayout, packLegendRows } from "./backlog"

describe("backlog legend rows", () => {
  test("caps long status legends so the issue list starts below a fixed row count", () => {
    const statuses = [
      "● To Do",
      "● Reopened",
      "● In Progress",
      "● Ready for QA",
      "● Ready for ACC/UAT",
      "● Done",
      "● Rejected",
      "● Fixed",
      "● Waiting for APIs",
    ].map((label) => ({ label, color: "#94A3B8" }))

    const packed = packLegendRows(statuses, 44, 2)

    expect(packed.rows).toHaveLength(2)
    expect(packed.overflow).toBeGreaterThan(0)
    expect(packed.rows.every((row) => row.map((token) => token.label).join("  ").length <= 44)).toBe(true)
  })

  test("keeps markers and text split for colored single-line rendering", () => {
    const packed = packLegendRows([{ label: "● Ready for ACC/UAT", color: "#F472B6" }], 80, 2)

    expect(packed.rows[0]?.[0]).toMatchObject({ marker: "●", text: "Ready for ACC/UAT" })
  })

  test("switches to the stacked issue layout on narrow terminals", () => {
    expect(backlogUsesCompactLayout(169)).toBe(true)
    expect(backlogUsesCompactLayout(170)).toBe(false)
  })

  test("scrolls to the selected issue unless its group is collapsed", () => {
    expect(backlogScrollTarget("sprint-1", "PROJ-2", false, ["PROJ-1", "PROJ-2"])).toBe("issue-PROJ-2")
    expect(backlogScrollTarget("sprint-1", "PROJ-2", true, ["PROJ-1", "PROJ-2"])).toBe("backlog-group-sprint-1")
  })
})
