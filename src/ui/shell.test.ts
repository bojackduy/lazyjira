import { describe, expect, test } from "bun:test"
import { footerItems } from "./shell"

describe("shell footer", () => {
  test("shows the parent shortcut only for child issue detail", () => {
    const board = { id: "1", name: "Board", type: "scrum" as const }

    expect(footerItems("main", "issue-detail", board, false, false, false, undefined, true)).toContain("enter parent")
    expect(footerItems("main", "issue-detail", board, false, false, false, undefined, false)).not.toContain("enter parent")
  })

  test("describes project discovery as Jira search with explicit pages", () => {
    const board = { id: "1", name: "Board", type: "scrum" as const }

    expect(footerItems("main", "board", board, false, false, false, "local")).toContain("a choose Jira project")
    expect(footerItems("main", "board", board, false, false, false, "remote-projects")).toEqual([
      "remote projects",
      "/ search Jira",
      "[/] page",
      "j/k choose",
      "enter choose",
      "r refresh",
      "h local",
    ])
  })
})
