import { routeLabel, type BoardType } from "../state/routes"

export type PaletteCommand = {
  name: string
  label: string
  description: string
  keys: string
  group: "Global" | "Navigation" | "Jira"
}

export function paletteCommandsForBoard(board: BoardType | { type: BoardType } = "scrum"): readonly PaletteCommand[] {
  const boardType = typeof board === "string" ? board : board.type
  return [
    command("app.quit", "Quit", "Close lazyjira.", "q · Esc", "Global"),
    command("help.open", "Keyboard help", "Show available actions and shortcuts.", "?", "Global"),
    command("command-palette.open", "Command palette", "Search and run an action.", "; · :", "Global"),
    command("route.workspace", "Workspace", "Open the workspace dashboard.", "1", "Navigation"),
    command("route.timeline", "Timeline", "Open the project hierarchy and schedule timeline.", "2", "Navigation"),
    command("route.backlog", "Backlog", "Open the backlog.", "3", "Navigation"),
    command("route.list", "List", "Open the paginated project issue list.", "4", "Navigation"),
    command("route.board", routeLabel("board", boardType), `Open the ${routeLabel("board", boardType).toLowerCase()} view.`, "5", "Navigation"),
    command("route.config", "Open metadata config", "Open board metadata configuration settings.", "palette", "Navigation"),
    command("project.switch", "Switch workspace", "Choose a saved Jira project and board.", "P", "Global"),
    command("search.open", "Filter loaded issues", "Filter issues already loaded in this workspace.", "/", "Global"),
    command("search.remote-open", "Search Jira", "Search Jira remotely.", "S", "Jira"),
    command("workspace.refresh", "Refresh workspace", "Reload the current Jira workspace.", "R", "Jira"),
    command("issue.refresh-detail", "Refresh current route", "Reload List or the selected issue detail while retaining successful data.", "r", "Jira"),
    command("issue.load-more", "Load more issues", "Load the next Jira issue page for the focused view.", "L", "Jira"),
    command("issue.new", "New issue", "Create a draft issue using the current board context.", "n", "Jira"),
    command("issue.move", "Move backlog issue", "Choose a loaded sprint or move the issue to backlog.", "m", "Jira"),
    command("issue.comment", "Add comment", "Stage a comment on the selected issue.", "c", "Jira"),
    command("issue.priority", "Change priority", "Edit the selected issue priority.", "p", "Jira"),
    command("issue.edit", "Edit issue", "Edit the selected issue field or detail body.", "e", "Jira"),
    command("issue.apply", "Render staged changes", "Apply staged changes to the local workspace view.", "w", "Jira"),
    command("issue.remote-apply", "Apply to Jira", "Review and apply staged Jira changes.", "W", "Jira"),
    command("staged-discard.open", "Discard staged changes", "Choose staged changes to discard.", "X", "Jira"),
  ]
}

export function searchPaletteCommands(query: string, board: BoardType | { type: BoardType } = "scrum") {
  const paletteCommands = paletteCommandsForBoard(board)
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return [...paletteCommands]
  return paletteCommands.filter((command) => {
    const haystack = `${command.label} ${command.description} ${command.keys} ${command.group}`.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

function command(name: string, label: string, description: string, keys: string, group: PaletteCommand["group"]): PaletteCommand {
  return { name, label, description, keys, group }
}
