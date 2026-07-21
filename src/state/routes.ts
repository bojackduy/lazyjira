export const appRoutes = [
  { id: "workspace", label: "Workspace Home", shortLabel: "Workspace" },
  { id: "active-sprint", label: "Active Sprint", shortLabel: "Sprint" },
  { id: "backlog", label: "Backlog", shortLabel: "Backlog" },
  { id: "kanban", label: "Kanban Board", shortLabel: "Kanban" },
] as const

export const sidebarRoutes = appRoutes

export type AppRoute = (typeof appRoutes)[number]["id"]

export function isAppRoute(value: string): value is AppRoute {
  return appRoutes.some((route) => route.id === value)
}

export function routeLabel(routeId: AppRoute) {
  return appRoutes.find((route) => route.id === routeId)?.label ?? routeId
}
