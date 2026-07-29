import { describe, expect, test } from "bun:test"
import { paletteCommands, searchPaletteCommands } from "./commands"

describe("command palette registry", () => {
  test("includes global discovery commands", () => {
    expect(paletteCommands.map((command) => command.name)).toEqual(expect.arrayContaining([
      "help.open",
      "command-palette.open",
      "route.active-sprint",
      "search.remote-open",
      "workspace.refresh",
    ]))
  })

  test("filters by command label, shortcut, and description", () => {
    expect(searchPaletteCommands("kanban").map((command) => command.name)).toContain("route.kanban")
    expect(searchPaletteCommands("remote jira").map((command) => command.name)).toContain("search.remote-open")
    expect(searchPaletteCommands("W").map((command) => command.name)).toContain("issue.remote-apply")
  })

  test("requires every search term to match", () => {
    expect(searchPaletteCommands("remote backlog")).toEqual([])
  })
})
