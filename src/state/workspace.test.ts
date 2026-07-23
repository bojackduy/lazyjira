import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { workspaceAttentionQueues, workspaceItems, workspacePendingItem, workspaceRecentItems, workspaceResultsForItem, workspaceSearchItems } from "./workspace"

describe("workspace dashboard", () => {
  test("builds jump, pending, attention, and recent items in order", () => {
    const state = loadDevWorkspaceState()
    const items = workspaceItems(state)

    expect(items.slice(0, 5).map((item) => item.id)).toEqual([
      "jump:active-sprint",
      "jump:backlog",
      "jump:kanban",
      "jump:my-work",
      "pending:staged",
    ])
  })

  test("summarizes staged edits and deletes", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { title: "Updated summary", statusId: "code-review" }
    state.issueDeletes = ["PROJ-181"]

    const pending = workspacePendingItem(state)

    expect(pending.count).toBe(3)
    expect(pending.subtitle).toBe("2 edits · 1 delete · X discard · W write Jira")
  })

  test("expands pending local into staged change rows", () => {
    const state = loadDevWorkspaceState()
    state.issueDrafts["PROJ-128"] = { title: "Updated summary" }
    state.issueDeletes = ["PROJ-181"]

    expect(workspaceResultsForItem(state, workspacePendingItem(state)).map((result) => result.id)).toEqual([
      "edit:PROJ-128:title",
      "delete:PROJ-181",
    ])
  })

  test("adds filtered loaded results when search is active", () => {
    const state = loadDevWorkspaceState()
    state.searchQuery = "assignee:duy auth"

    const searchItem = workspaceSearchItems(state)[0]

    expect(searchItem?.id).toBe("search:loaded")
    expect(searchItem?.issueKeys).toContain("PROJ-128")
    expect(workspaceResultsForItem(state, searchItem).map((result) => result.issueKey)).toContain("PROJ-128")
  })

  test("includes attention queues for blocked, stale, unassigned, no sprint, and no estimate", () => {
    const state = loadDevWorkspaceState()
    const queues = workspaceAttentionQueues(state)

    expect(queues.map((queue) => queue.id)).toEqual(["queue:blocked", "queue:stale", "queue:unassigned", "queue:no-sprint", "queue:no-estimate"])
    expect(queues.find((queue) => queue.id === "queue:blocked")?.subtitle).toBe("Blocked flag or Blocked workflow status")
    expect(queues.find((queue) => queue.id === "queue:stale")?.subtitle).toBe("No update for at least 7 days")
    expect(queues.find((queue) => queue.id === "queue:unassigned")?.subtitle).toBe("No owner assigned")
    expect(queues.find((queue) => queue.id === "queue:blocked")?.count).toBeGreaterThan(0)
    expect(queues.find((queue) => queue.id === "queue:unassigned")?.issueKeys).toContain("PROJ-211")
  })

  test("expands attention queues into issue result rows", () => {
    const state = loadDevWorkspaceState()
    const blocked = workspaceAttentionQueues(state).find((queue) => queue.id === "queue:blocked")

    const results = workspaceResultsForItem(state, blocked)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.kind).toBe("issue")
    expect(results[0]?.issueKey).toBeTruthy()
    expect(results[0]?.subtitle).toContain("blocked")
  })

  test("puts the selected issue first in recent items", () => {
    const state = loadDevWorkspaceState()
    state.selectedIssueKey = "PROJ-170"

    expect(workspaceRecentItems(state)[0]?.id).toBe("recent:PROJ-170")
  })
})
