import type { WorkspaceSelection, WorkspaceSource } from "../types"
import { devBoardsByProjectKey, devProjects, loadDevWorkspaceFixture } from "./fixtures"

export function createDevWorkspaceSource(): WorkspaceSource {
  return {
    env: "dev",
    async fetchProjects() {
      return [...devProjects]
    },
    async fetchBoards(projectKeyOrId) {
      const project = devProjects.find((candidate) => candidate.key === projectKeyOrId || candidate.id === projectKeyOrId)
      return [...(devBoardsByProjectKey[project?.key ?? projectKeyOrId] ?? [])]
    },
    async loadWorkspace(selection: WorkspaceSelection) {
      return loadDevWorkspaceFixture(selection.project.key)
    },
  }
}
