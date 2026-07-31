import type { AppState, BoardOption, ProjectOption, WorkspaceOption } from "./app-state"

export function filteredProjectPickerWorkspaces(state: AppState): WorkspaceOption[] {
  return state.recentWorkspaces.filter((workspace) => matchesQuery(state.projectPicker.searchQuery, [workspace.projectKey, workspace.projectName, workspace.boardId, workspace.boardName, workspace.boardType]))
}

export function filteredProjectPickerProjects(state: AppState): ProjectOption[] {
  return state.projectPicker.remoteProjectPage?.items ?? []
}

export function filteredProjectPickerBoards(state: AppState): BoardOption[] {
  const projectKey = state.projectPicker.selectedProject?.key
  const boards = projectKey ? (state.projectPicker.remoteBoardsByProject[projectKey] ?? []) : []
  return boards.filter((board) => matchesQuery(state.projectPicker.searchQuery, [board.name, board.type, board.id]))
}

export function filteredProjectPickerOptions(state: AppState): Array<WorkspaceOption | ProjectOption | BoardOption> {
  if (state.projectPicker.mode === "local") return filteredProjectPickerWorkspaces(state)
  return state.projectPicker.mode === "remote-projects" ? filteredProjectPickerProjects(state) : filteredProjectPickerBoards(state)
}

function matchesQuery(query: string, values: string[]) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = values.join(" ").toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

export function normalizedProjectQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ")
}

export function projectPageCacheKey(query: string, startAt: number) {
  return `${normalizedProjectQuery(query)}\u0000${startAt}`
}

export function projectPageStatus(state: AppState) {
  const page = state.projectPicker.remoteProjectPage
  if (!page) return "0-0 of 0 · page 0/0"
  const first = page.items.length ? page.startAt + 1 : 0
  const last = page.startAt + page.items.length
  const pageNumber = page.total ? Math.floor(page.startAt / page.maxResults) + 1 : 0
  const pageCount = page.total ? Math.ceil(page.total / page.maxResults) : 0
  return `${first}-${last} of ${page.total} · page ${pageNumber}/${pageCount}`
}
