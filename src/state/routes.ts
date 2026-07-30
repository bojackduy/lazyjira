export type RouteScope = "global" | "project" | "internal" | "settings"
export type BoardType = "scrum" | "kanban"
export type LegacyBoardRoute = "active-sprint" | "kanban"

export type RouteDefinition = {
  id: "workspace" | "timeline" | "backlog" | "list" | "board" | "config" | "issue-detail"
  scope: RouteScope
  label: string | ((boardType: BoardType) => string)
  shortLabel: string | ((boardType: BoardType) => string)
  shortcut?: string
}

export const appRoutes = [
  { id: "workspace", scope: "global", label: "Workspace Home", shortLabel: "Workspace", shortcut: "1" },
  { id: "timeline", scope: "project", label: "Timeline", shortLabel: "Timeline", shortcut: "2" },
  { id: "backlog", scope: "project", label: "Backlog", shortLabel: "Backlog", shortcut: "3" },
  { id: "list", scope: "project", label: "List", shortLabel: "List", shortcut: "4" },
  {
    id: "board",
    scope: "project",
    label: (boardType: BoardType) => boardCapabilities(boardType).projectBoardLabel,
    shortLabel: (boardType: BoardType) => boardCapabilities(boardType).projectBoardLabel,
    shortcut: "5",
  },
  { id: "config", scope: "settings", label: "Metadata Config", shortLabel: "Config" },
  { id: "issue-detail", scope: "internal", label: "Issue Detail", shortLabel: "Detail" },
] as const satisfies readonly RouteDefinition[]

export type AppRoute = (typeof appRoutes)[number]["id"]

export type BoardCapabilities = {
  mode: BoardType
  projectBoardLabel: "Active sprints" | "Board"
  supportsSprints: boolean
  supportsSprintBacklog: boolean
}

export function boardCapabilities(board: BoardType | { type: BoardType }): BoardCapabilities {
  const mode = typeof board === "string" ? board : board.type
  return mode === "scrum"
    ? { mode, projectBoardLabel: "Active sprints", supportsSprints: true, supportsSprintBacklog: true }
    : { mode, projectBoardLabel: "Board", supportsSprints: false, supportsSprintBacklog: false }
}

export function boardModeForBoard(board: BoardType | { type: BoardType }): LegacyBoardRoute {
  return boardCapabilities(board).mode === "scrum" ? "active-sprint" : "kanban"
}

export function sidebarRoutesForBoard(board: BoardType | { type: BoardType }) {
  const boardType = typeof board === "string" ? board : board.type
  return appRoutes
    .filter((route) => route.scope === "global" || route.scope === "project")
    .map((route) => ({ ...route, label: resolveLabel(route.label, boardType), shortLabel: resolveLabel(route.shortLabel, boardType) }))
}

export function sidebarQuickFilterIndex(board: BoardType | { type: BoardType }, filterIndex: number) {
  return sidebarRoutesForBoard(board).length + filterIndex
}

export function sidebarEntryCount(board: BoardType | { type: BoardType }, quickFilterCount: number) {
  return sidebarRoutesForBoard(board).length + quickFilterCount
}

export function isAppRoute(value: string): value is AppRoute {
  return appRoutes.some((route) => route.id === value)
}

export function normalizePersistedRoute(value: unknown, fallback: AppRoute = "board"): AppRoute {
  if (value === "active-sprint" || value === "kanban") return "board"
  if (typeof value !== "string" || !isAppRoute(value)) return fallback
  return routeScope(value) === "internal" ? fallback : value
}

export function routeScope(routeId: AppRoute): RouteScope {
  return appRoutes.find((route) => route.id === routeId)?.scope ?? "internal"
}

export function routeLabel(routeId: AppRoute, board: BoardType | { type: BoardType } = "scrum") {
  const route = appRoutes.find((candidate) => candidate.id === routeId)
  if (!route) return routeId
  return resolveLabel(route.label, typeof board === "string" ? board : board.type)
}

function resolveLabel(label: string | ((boardType: BoardType) => string), boardType: BoardType) {
  return typeof label === "function" ? label(boardType) : label
}
