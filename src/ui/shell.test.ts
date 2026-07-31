import { describe, expect, test } from "bun:test"
import { footerItems } from "./shell"

describe("shell footer", () => {
  test("shows the parent shortcut only for child issue detail", () => {
    const board = { id: "1", name: "Board", type: "scrum" as const }

    expect(footerItems("main", "issue-detail", board, false, false, false, undefined, true)).toContain("enter parent")
    expect(footerItems("main", "issue-detail", board, false, false, false, undefined, false)).not.toContain("enter parent")
  })
})
