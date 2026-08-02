import { describe, expect, test } from "bun:test"
import { materializeRankDraft, projectRankDrafts } from "./rank-projection"

describe("rank projection", () => {
  test("projects chained relative rank drafts without changing the source order", () => {
    const source = ["A", "B", "C", "D"]
    const projected = projectRankDrafts(source, {
      A: { issueKey: "A", targetIssueKey: "B", position: "after" },
      D: { issueKey: "D", targetIssueKey: "A", position: "before" },
    })

    expect(projected).toEqual(["B", "D", "A", "C"])
    expect(source).toEqual(["A", "B", "C", "D"])
  })

  test("materializes a successful rank only in loaded sources containing both issues", () => {
    const sources = {
      backlog: ["A", "B", "C"],
      "project-list": ["C", "B", "A"],
      unrelated: ["A", "D"],
    }

    expect(materializeRankDraft(sources, { issueKey: "A", targetIssueKey: "B", position: "after" })).toEqual({
      backlog: ["B", "A", "C"],
      "project-list": ["C", "B", "A"],
      unrelated: ["A", "D"],
    })
  })
})
