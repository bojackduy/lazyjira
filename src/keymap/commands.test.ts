import { describe, expect, test } from "bun:test"
import { paletteCommandsForBoard, searchPaletteCommands } from "./commands"

describe("command palette registry", () => {
  test("includes global discovery commands", () => {
    expect(paletteCommandsForBoard().map((command) => command.name)).toEqual(expect.arrayContaining([
      "help.open",
      "command-palette.open",
      "route.timeline",
      "route.board",
      "search.remote-open",
      "workspace.refresh",
    ]))
  })

  test("filters by command label, shortcut, and description", () => {
    expect(searchPaletteCommands("board", "kanban").map((command) => command.name)).toContain("route.board")
    expect(searchPaletteCommands("remote jira").map((command) => command.name)).toContain("search.remote-open")
    expect(searchPaletteCommands("W").map((command) => command.name)).toContain("issue.remote-apply")
  })

  test("uses board-aware labels and reserves p for Priority", () => {
    expect(paletteCommandsForBoard("scrum").find((command) => command.name === "route.board")?.label).toBe("Active sprints")
    expect(paletteCommandsForBoard("kanban").find((command) => command.name === "route.board")?.label).toBe("Board")
    expect(paletteCommandsForBoard().find((command) => command.name === "command-palette.open")?.keys).toBe("; · :")
    expect(paletteCommandsForBoard().find((command) => command.name === "issue.priority")?.keys).toBe("p")
  })

  test("requires every search term to match", () => {
    expect(searchPaletteCommands("remote backlog")).toEqual([])
  })
})
