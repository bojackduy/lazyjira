import { describe, expect, test } from "bun:test"
import { loadDemoWorkspace } from "./demo"
import { discardedActiveEditors, stagedChanges, stagedDiscardTargetIds } from "./staged-changes"

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

  test("defaults discard target to the highlighted staged change", () => {
    const state = loadDemoWorkspace()
    state.issueDrafts["PROJ-128"] = { title: "Updated summary", description: "Updated body" }
    const changes = stagedChanges(state)

    expect([...stagedDiscardTargetIds(changes, 1, [])]).toEqual(["edit:PROJ-128:description"])
  })

  test("uses marked discard targets when present", () => {
    const state = loadDemoWorkspace()
    state.issueDrafts["PROJ-128"] = { title: "Updated summary", description: "Updated body" }
    state.issueDeletes = ["PROJ-121"]
    const changes = stagedChanges(state)

    expect([...stagedDiscardTargetIds(changes, 0, ["edit:PROJ-128:description", "delete:PROJ-121"])]).toEqual(["edit:PROJ-128:description", "delete:PROJ-121"])
  })

  test("has no discard targets when nothing is staged", () => {
    expect([...stagedDiscardTargetIds([], 0, [])]).toEqual([])
  })

  test("detects discarded active inspector choice editor", () => {
    const state = loadDemoWorkspace()
    state.issueDrafts["PROJ-128"] = { statusId: "code-review" }
    const changes = stagedChanges(state)
    const selectedIds = stagedDiscardTargetIds(changes, 0, [])

    expect(discardedActiveEditors(changes, selectedIds, "PROJ-128", "statusId", false)).toEqual({ inspector: true, detailBody: false })
  })

  test("detects discarded active detail body editor", () => {
    const state = loadDemoWorkspace()
    state.issueDrafts["PROJ-128"] = { description: "Updated body" }
    const changes = stagedChanges(state)
    const selectedIds = stagedDiscardTargetIds(changes, 0, [])

    expect(discardedActiveEditors(changes, selectedIds, "PROJ-128", undefined, true)).toEqual({ inspector: false, detailBody: true })
  })
})
