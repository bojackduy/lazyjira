import { describe, expect, test } from "bun:test"
import { backlogLayout, backlogScrollTarget, estimatedBacklogViewportWidth, packLegendRows, planBacklogRow, truncateCellText } from "./backlog"

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

  test("plans rows from available Backlog width instead of one terminal breakpoint", () => {
    expect(backlogLayout(67, true)).toMatchObject({ mode: "narrow", rowWidth: 67, showHealth: false })
    expect(backlogLayout(90, true)).toMatchObject({ mode: "medium", rowWidth: 90, showHealth: false })
    expect(backlogLayout(120, true)).toMatchObject({ mode: "wide", rowWidth: 120, showHealth: false })
    expect(backlogLayout(145, true)).toMatchObject({ mode: "wide", rowWidth: 114, showHealth: true })
  })

  test("estimates the pane width conservatively until the renderable is measured", () => {
    expect(estimatedBacklogViewportWidth(80)).toBe(72)
    expect(estimatedBacklogViewportWidth(120)).toBe(48)
    expect(estimatedBacklogViewportWidth(220)).toBe(148)
  })

  test("uses ellipsis instead of allowing a title to collide with metadata", () => {
    const plan = planBacklogRow({
      width: 72,
      allowInline: true,
      typeIcon: "•",
      issueKey: "HPCE-2016",
      typeName: "Improvement",
      title: "Pending Order reminder - Navigate to order detail",
      status: "◐ Ready for QA",
      priority: "– Medium",
      priorityIcon: "–",
      points: "2 pts",
      assignee: "My Le Thuy Tra",
      unassigned: false,
    })

    expect(plan.inline).toBe(true)
    expect(plan.title.endsWith("…")).toBe(true)
    expect(plan.metadata[0]?.text).toBe("◐ Ready for QA")
  })

  test("truncates by terminal cells and preserves a visible boundary", () => {
    expect(truncateCellText("Asset Depository title", 12)).toBe("Asset Depos…")
    expect(Bun.stringWidth(truncateCellText("Asset Depository title", 12))).toBe(12)
  })

  test("scrolls to the selected issue unless its group is collapsed", () => {
    expect(backlogScrollTarget("sprint-1", "PROJ-2", false, ["PROJ-1", "PROJ-2"])).toBe("issue-PROJ-2")
    expect(backlogScrollTarget("sprint-1", "PROJ-2", true, ["PROJ-1", "PROJ-2"])).toBe("backlog-group-sprint-1")
  })
})
