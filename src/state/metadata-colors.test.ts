import { describe, expect, test } from "bun:test"
import { statusColorForStatus } from "./metadata-colors"

describe("status metadata colors", () => {
  test("differentiates HPCE workflow statuses by semantic intent", () => {
    const inProgress = "in-progress" as const
    expect(statusColorForStatus("Planned", inProgress, "", "yellow")).toBe("#FBBF24")
    expect(statusColorForStatus("In Progress", inProgress, "", "yellow")).toBe("#38BDF8")
    expect(statusColorForStatus("QA", inProgress, "", "yellow")).toBe("#F472B6")
    expect(statusColorForStatus("Ready for ACC/UAT", inProgress, "", "yellow")).toBe("#F472B6")
    expect(statusColorForStatus("Ready for review", inProgress, "", "yellow")).toBe("#A78BFA")
    expect(statusColorForStatus("Ready for ACC", inProgress, "", "yellow")).toBe("#22D3EE")
    expect(statusColorForStatus("Rejected", "done", "", "green")).toBe("#F97316")
    expect(statusColorForStatus("Reopened", "todo", "", "blue-gray")).toBe("#F59E0B")
    expect(statusColorForStatus("Done", "done", "", "green")).toBe("#22C55E")
  })

  test("uses Jira status categories only when no semantic intent matches", () => {
    expect(statusColorForStatus("ACC", "in-progress", "", "yellow")).toBe("#38BDF8")
    expect(statusColorForStatus("Custom queue", "todo", "", "blue-gray")).toBe("#94A3B8")
    expect(statusColorForStatus("Archived state", "done", "", "green")).toBe("#22C55E")
  })
})
