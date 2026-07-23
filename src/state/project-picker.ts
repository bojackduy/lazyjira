import type { AppState, BoardOption, ProjectOption, WorkspaceOption } from "./app-state"

export function filteredProjectPickerWorkspaces(state: AppState): WorkspaceOption[] {
  return state.recentWorkspaces.filter((workspace) => matchesQuery(state.projectPicker.searchQuery, [workspace.projectKey, workspace.projectName, workspace.boardId, workspace.boardName, workspace.boardType]))
}

export function filteredProjectPickerProjects(state: AppState): ProjectOption[] {
  return (state.projectPicker.remoteProjectCache ?? []).filter((project) => matchesQuery(state.projectPicker.searchQuery, [project.key, project.name, project.id]))
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
