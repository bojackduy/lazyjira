import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { discardedActiveEditors, stagedChanges, stagedDiscardTargetIds } from "./staged-changes"

describe("staged changes", () => {
  test("lists staged field edits and issue deletes", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { title: "Updated summary", description: "Updated body" }
    state.issueDeletes = ["PROJ-121"]

    expect(stagedChanges(state).map((change) => change.id)).toEqual([
      "edit:PROJ-128:title",
      "edit:PROJ-128:description",
      "delete:PROJ-121",
    ])
    expect(stagedChanges(state).map((change) => change.label)).toEqual(["Summary", "Body", "Delete issue"])
  })

  test("lists draft issues as staged creates", () => {
    const state = loadDevWorkspaceState()
    state.issues["DRAFT-1"] = { ...state.issues["PROJ-121"]!, key: "DRAFT-1", title: "New issue", isDraft: true }

    expect(stagedChanges(state).map((change) => change.id)).toContain("create:DRAFT-1")
    expect(stagedChanges(state).find((change) => change.id === "create:DRAFT-1")).toMatchObject({ kind: "create", issueKey: "DRAFT-1", label: "Create issue" })
  })

  test("lists staged comments and rank operations", () => {
    const state = loadDevWorkspaceState()
    state.commentDrafts = [{ id: "comment-1", issueKey: "PROJ-128", body: "Ready for review" }]
    state.rankDrafts = { "PROJ-128": { issueKey: "PROJ-128", targetIssueKey: "PROJ-121", position: "after" } }

    expect(stagedChanges(state).map((change) => change.id)).toEqual(["comment:comment-1", "rank:PROJ-128"])
    expect(stagedChanges(state).map((change) => change.label)).toEqual(["Comment", "Rank issue"])
  })

  test("defaults discard target to the highlighted staged change", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { title: "Updated summary", description: "Updated body" }
    const changes = stagedChanges(state)

    expect([...stagedDiscardTargetIds(changes, 1, [])]).toEqual(["edit:PROJ-128:description"])
  })

  test("uses marked discard targets when present", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { title: "Updated summary", description: "Updated body" }
    state.issueDeletes = ["PROJ-121"]
    const changes = stagedChanges(state)

    expect([...stagedDiscardTargetIds(changes, 0, ["edit:PROJ-128:description", "delete:PROJ-121"])]).toEqual(["edit:PROJ-128:description", "delete:PROJ-121"])
  })

  test("has no discard targets when nothing is staged", () => {
    expect([...stagedDiscardTargetIds([], 0, [])]).toEqual([])
  })

  test("detects discarded active inspector choice editor", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { statusId: "code-review" }
    const changes = stagedChanges(state)
    const selectedIds = stagedDiscardTargetIds(changes, 0, [])

    expect(discardedActiveEditors(changes, selectedIds, "PROJ-128", "statusId", false)).toEqual({ inspector: true, detailBody: false })
  })

  test("detects discarded active detail body editor", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { description: "Updated body" }
    const changes = stagedChanges(state)
    const selectedIds = stagedDiscardTargetIds(changes, 0, [])

    expect(discardedActiveEditors(changes, selectedIds, "PROJ-128", undefined, true)).toEqual({ inspector: false, detailBody: true })
  })
})
