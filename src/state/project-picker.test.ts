import { describe, expect, test } from "bun:test"
import { loadDevWorkspaceState } from "./dev"
import { filteredProjectPickerBoards, filteredProjectPickerProjects, filteredProjectPickerWorkspaces } from "./project-picker"

describe("project picker filtering", () => {
  test("filters local workspaces by project and board", () => {
    const state = loadDevWorkspaceState()
    state.recentWorkspaces = [
      { id: "PROJ:10", projectKey: "PROJ", projectName: "Product Platform", boardId: "10", boardName: "Platform Kanban", boardType: "kanban" },
      { id: "MOB:20", projectKey: "MOB", projectName: "Mobile Apps", boardId: "20", boardName: "Release Scrum", boardType: "scrum" },
    ]

    state.projectPicker.searchQuery = "mobile scrum"

    expect(filteredProjectPickerWorkspaces(state).map((workspace) => workspace.id)).toEqual(["MOB:20"])
  })

  test("filters projects by key and name", () => {
    const state = loadDevWorkspaceState()
    state.projectPicker.remoteProjectCache = [
      { id: "dev-proj", key: "PROJ", name: "Product Platform" },
      { id: "dev-mob", key: "MOB", name: "Mobile Apps" },
      { id: "dev-ops", key: "OPS", name: "Internal Operations" },
    ]

    state.projectPicker.searchQuery = "mob"
    expect(filteredProjectPickerProjects(state).map((project) => project.key)).toEqual(["MOB"])

    state.projectPicker.searchQuery = "internal ops"
    expect(filteredProjectPickerProjects(state).map((project) => project.key)).toEqual(["OPS"])
  })

  test("filters boards by name, type, and id", () => {
    const state = loadDevWorkspaceState()
    state.projectPicker.selectedProject = { id: "dev-proj", key: "PROJ", name: "Product Platform" }
    state.projectPicker.remoteBoardsByProject.PROJ = [
      { id: "10", name: "Platform Kanban", type: "kanban" },
      { id: "20", name: "Release Scrum", type: "scrum" },
    ]

    state.projectPicker.searchQuery = "scrum"
    expect(filteredProjectPickerBoards(state).map((board) => board.id)).toEqual(["20"])

    state.projectPicker.searchQuery = "platform 10"
    expect(filteredProjectPickerBoards(state).map((board) => board.id)).toEqual(["10"])
  })
})
