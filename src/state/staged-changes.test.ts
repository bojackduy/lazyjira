import { describe, expect, test } from "bun:test"
import { loadDemoWorkspace } from "./demo"
import { stagedChanges } from "./staged-changes"

describe("staged changes", () => {
  test("lists staged field edits and issue deletes", () => {
    const state = loadDemoWorkspace()
    state.issueDrafts["PROJ-128"] = { title: "Updated summary", description: "Updated body" }
    state.issueDeletes = ["PROJ-121"]

    expect(stagedChanges(state).map((change) => change.id)).toEqual([
      "edit:PROJ-128:title",
      "edit:PROJ-128:description",
      "delete:PROJ-121",
    ])
    expect(stagedChanges(state).map((change) => change.label)).toEqual(["Summary", "Body", "Delete issue"])
  })
})
