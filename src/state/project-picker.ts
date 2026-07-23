import type { AppState, BoardOption, ProjectOption } from "./app-state"

export function filteredProjectPickerProjects(state: AppState): ProjectOption[] {
  return state.projectPicker.projects.filter((project) => matchesQuery(state.projectPicker.searchQuery, [project.key, project.name, project.id]))
}

export function filteredProjectPickerBoards(state: AppState): BoardOption[] {
  return state.projectPicker.boards.filter((board) => matchesQuery(state.projectPicker.searchQuery, [board.name, board.type, board.id]))
}

export function filteredProjectPickerOptions(state: AppState): Array<ProjectOption | BoardOption> {
  return state.projectPicker.step === "project" ? filteredProjectPickerProjects(state) : filteredProjectPickerBoards(state)
}

function matchesQuery(query: string, values: string[]) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const haystack = values.join(" ").toLowerCase()
  return terms.every((term) => haystack.includes(term))
}
