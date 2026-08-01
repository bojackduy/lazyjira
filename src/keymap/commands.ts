import { routeLabel, type AppRoute, type BoardType } from "../state/routes"
import type { SemanticIconCatalog } from "../icons/catalog"

export type PaletteCommandIcon =
  | { group: "route"; name: keyof SemanticIconCatalog["route"] }
  | { group: "action"; name: keyof SemanticIconCatalog["action"] }
  | { group: "exceptional"; name: keyof SemanticIconCatalog["exceptional"] }

export type PaletteCommand = {
  name: string
  label: string
  description: string
  keys: string
  group: "Global" | "Navigation" | "Jira"
  icon?: PaletteCommandIcon
}

export function paletteCommandsForBoard(board: BoardType | { type: BoardType } = "scrum"): readonly PaletteCommand[] {
  const boardType = typeof board === "string" ? board : board.type
  return [
    command("app.quit", "Quit", "Close lazyjira.", "q · Esc", "Global"),
    command("help.open", "Keyboard help", "Show available actions and shortcuts.", "?", "Global"),
    command("command-palette.open", "Command palette", "Search and run an action.", "; · :", "Global", { group: "action", name: "search" }),
    command("icons.change", "Change icon mode", "Preview and select Nerd Font, Unicode, or ASCII icons.", "palette", "Global", { group: "route", name: "config" }),
    command("route.workspace", "Workspace", "Open the workspace dashboard.", "1", "Navigation", { group: "route", name: "workspace" }),
    command("route.timeline", "Timeline", "Open the project hierarchy and schedule timeline.", "2", "Navigation", { group: "route", name: "timeline" }),
    command("route.backlog", "Backlog", "Open the backlog.", "3", "Navigation", { group: "route", name: "backlog" }),
    command("route.list", "List", "Open the paginated project issue list.", "4", "Navigation", { group: "route", name: "list" }),
    command("route.board", routeLabel("board", boardType), `Open the ${routeLabel("board", boardType).toLowerCase()} view.`, "5", "Navigation", { group: "route", name: "board" }),
    command("route.config", "Open metadata config", "Open board metadata configuration settings.", "palette", "Navigation", { group: "route", name: "config" }),
    command("project.switch", "Switch workspace", "Choose a saved Jira project and board.", "P", "Global", { group: "route", name: "workspace" }),
    command("search.open", "Filter loaded issues", "Filter issues already loaded in this workspace.", "/", "Global", { group: "action", name: "search" }),
    command("search.remote-open", "Search Jira", "Search Jira remotely.", "S", "Jira", { group: "action", name: "search" }),
    command("workspace.refresh", "Refresh workspace", "Reload the current Jira workspace.", "R", "Jira", { group: "action", name: "refresh" }),
    command("issue.refresh-detail", "Refresh current route", "Reload List or the selected issue detail while retaining successful data.", "r", "Jira", { group: "action", name: "refresh" }),
    command("issue.load-more", "Load more issues", "Load the next Jira issue page for the focused view.", "L", "Jira", { group: "action", name: "refresh" }),
    command("issue.new", "New issue", "Create a draft issue using the current board context.", "n", "Jira", { group: "action", name: "create" }),
    command("issue.move", "Move backlog issue", "Choose a loaded sprint or move the issue to backlog.", "m", "Jira", { group: "action", name: "transition" }),
    command("issue.assign", "Assign issue", "Choose an assignable Jira user for the selected issue.", "a", "Jira", { group: "action", name: "assign" }),
    command("issue.status", "Change status", "Choose a valid status for the selected issue.", "s", "Jira", { group: "action", name: "transition" }),
    command("issue.comment", "Add comment", "Stage a comment on the selected issue.", "c", "Jira", { group: "action", name: "comment" }),
    command("issue.priority", "Change priority", "Edit the selected issue priority.", "p", "Jira", { group: "action", name: "priority" }),
    command("issue.open-browser", "Open in Jira", "Open the selected issue in the configured Jira site.", "o", "Jira", { group: "action", name: "open" }),
    command("issue.open-parent", "Open parent issue", "Open the selected child issue's parent from issue detail.", "Enter in detail", "Jira", { group: "exceptional", name: "parent" }),
    command("issue.edit", "Edit issue", "Edit the selected issue field or detail body.", "e", "Jira", { group: "action", name: "edit" }),
    command("issue.apply", "Render staged changes", "Apply staged changes to the local workspace view.", "w", "Jira", { group: "action", name: "apply" }),
    command("issue.remote-apply", "Apply to Jira", "Review and apply staged Jira changes.", "W", "Jira", { group: "action", name: "apply" }),
    command("staged-discard.open", "Discard staged changes", "Choose staged changes to discard.", "X", "Jira", { group: "action", name: "delete" }),
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

export function routeHelpCommands(route: AppRoute): readonly PaletteCommand[] {
  if (route !== "timeline" && route !== "list") return []
  const label = route === "timeline" ? "Timeline" : "List"
  return [
    command(`${route}.page.down`, `${label} half-page down`, "Move selection down by half the visible viewport and keep it on screen.", "d · Ctrl-d", "Navigation"),
    command(`${route}.page.up`, `${label} half-page up`, "Move selection up by half the visible viewport and keep it on screen.", "u · Ctrl-u", "Navigation"),
  ]
}

function command(name: string, label: string, description: string, keys: string, group: PaletteCommand["group"], icon?: PaletteCommandIcon): PaletteCommand {
  return { name, label, description, keys, group, icon }
}
