import { describe, expect, test } from "bun:test"
import { paletteCommandsForBoard, routeHelpCommands, searchPaletteCommands } from "./commands"

describe("command palette registry", () => {
  test("includes global discovery commands", () => {
    expect(paletteCommandsForBoard().map((command) => command.name)).toEqual(expect.arrayContaining([
      "help.open",
      "command-palette.open",
      "route.timeline",
      "route.board",
      "search.remote-open",
      "workspace.refresh",
      "issue.assign",
      "issue.status",
      "issue.open-browser",
      "issue.open-parent",
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
    expect(paletteCommandsForBoard().find((command) => command.name === "issue.assign")?.keys).toBe("a")
  })

  test("describes route and action icons semantically without embedding glyphs", () => {
    const commands = paletteCommandsForBoard("scrum")

    expect(commands.find((command) => command.name === "route.workspace")?.icon).toEqual({ group: "route", name: "workspace" })
    expect(commands.find((command) => command.name === "route.board")?.icon).toEqual({ group: "route", name: "board" })
    expect(commands.find((command) => command.name === "search.remote-open")?.icon).toEqual({ group: "action", name: "search" })
    expect(commands.find((command) => command.name === "issue.new")?.icon).toEqual({ group: "action", name: "create" })
    expect(commands.find((command) => command.name === "issue.remote-apply")?.icon).toEqual({ group: "action", name: "apply" })
  })

  test("requires every search term to match", () => {
    expect(searchPaletteCommands("remote backlog")).toEqual([])
  })

  test("provides selection-aware paging help only for Timeline and List", () => {
    expect(routeHelpCommands("timeline").map((command) => [command.name, command.keys])).toEqual([
      ["timeline.page.down", "d · Ctrl-d"],
      ["timeline.page.up", "u · Ctrl-u"],
    ])
    expect(routeHelpCommands("list").map((command) => command.name)).toEqual(["list.page.down", "list.page.up"])
    expect(routeHelpCommands("board")).toEqual([])
  })
})
