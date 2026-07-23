import { afterEach, describe, expect, test } from "bun:test"
import { createComponent, createRoot } from "solid-js"
import { ToastProvider } from "./toast"
import { AppStateProvider, useAppState, type AppStateContext } from "./app-state"
import { createInitialAppState } from "../state/initial"
import { devBoardsByProjectKey, devProjects, loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import type { WorkspaceSource } from "../workspace/types"
import type { JiraWorkspaceConfig } from "../auth/config"

const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length) disposers.pop()?.()
})

describe("app state project picker", () => {
  test("opens local workspace switcher without fetching remote projects", () => {
    let fetchProjectsCount = 0
    const appState = createTestAppState({
      async fetchProjects() {
        fetchProjectsCount += 1
        return [...devProjects]
      },
    })

    appState.openProjectPicker()

    expect(appState.state.projectPicker.open).toBe(true)
    expect(appState.state.projectPicker.mode).toBe("local")
    expect(fetchProjectsCount).toBe(0)
  })

  test("opens local workspace switcher even before prod auth is ready", () => {
    let fetchProjectsCount = 0
    const appState = createTestAppState({
      env: "prod",
      async fetchProjects() {
        fetchProjectsCount += 1
        return [...devProjects]
      },
    })

    appState.openProjectPicker()

    expect(appState.state.projectPicker.open).toBe(true)
    expect(appState.state.projectPicker.mode).toBe("local")
    expect(appState.state.authOnboarding.open).toBe(false)
    expect(fetchProjectsCount).toBe(0)
  })

  test("remote browse fetches project cache only on demand", async () => {
    let fetchProjectsCount = 0
    const appState = createTestAppState({
      async fetchProjects() {
        fetchProjectsCount += 1
        return [...devProjects]
      },
    })

    await appState.browseRemoteProjects()
    await appState.browseRemoteProjects()

    expect(appState.state.projectPicker.mode).toBe("remote-projects")
    expect(appState.state.projectPicker.remoteProjectCache?.map((project) => project.key)).toEqual(["PROJ", "MOB", "OPS"])
    expect(fetchProjectsCount).toBe(1)
  })

  test("remote selection of the already loaded default workspace still persists config", async () => {
    let loadWorkspaceCount = 0
    const savedWorkspaces: JiraWorkspaceConfig[] = []
    const appState = createTestAppState(
      {
        async loadWorkspace(selection) {
          loadWorkspaceCount += 1
          return loadDevWorkspaceFixture(selection.project.key)
        },
      },
      async (workspace) => {
        savedWorkspaces.push(workspace)
      },
    )

    await appState.browseRemoteProjects()
    appState.updateProjectPickerSearch("Product")
    expect(appState.state.projectPicker.remoteProjectCache?.map((project) => project.key)).toEqual(["PROJ", "MOB", "OPS"])
    expect(appState.state.projectPicker.searchQuery).toBe("Product")
    expect(appState.state.projectPicker.selectedIndex).toBe(0)
    await appState.selectProjectPickerItem()
    expect(appState.state.projectPicker.selectedProject?.key).toBe("PROJ")
    expect(appState.state.projectPicker.remoteBoardsByProject.PROJ?.map((board) => board.id)).toEqual(["dev-board-proj"])
    await appState.selectProjectPickerItem()

    expect(loadWorkspaceCount).toBe(0)
    expect(savedWorkspaces).toEqual([{ projectKey: "PROJ", projectName: "Product Platform", boardId: "dev-board-proj", boardName: "Product Kanban", boardType: "kanban" }])
    expect(appState.state.jiraProjectReady).toBe(true)
    expect(appState.state.recentWorkspaces.map((workspace) => workspace.id)).toEqual(["PROJ:dev-board-proj"])
  })

  test("remote project selection fetches boards before final workspace load", async () => {
    let fetchBoardsCount = 0
    let loadWorkspaceCount = 0
    const appState = createTestAppState({
      async fetchBoards(projectKeyOrId) {
        fetchBoardsCount += 1
        expect(projectKeyOrId).toBe("MOB")
        return [...devBoardsByProjectKey.MOB!]
      },
      async loadWorkspace(selection) {
        loadWorkspaceCount += 1
        expect(selection.project.key).toBe("MOB")
        expect(selection.board.id).toBe("dev-board-mob")
        return loadDevWorkspaceFixture(selection.project.key)
      },
    })

    await appState.browseRemoteProjects()
    appState.moveProjectPickerSelection(1)
    await appState.selectProjectPickerItem()

    expect(appState.state.projectPicker.mode).toBe("remote-boards")
    expect(fetchBoardsCount).toBe(1)
    expect(loadWorkspaceCount).toBe(0)

    await appState.selectProjectPickerItem()

    expect(loadWorkspaceCount).toBe(1)
    expect(appState.state.project.key).toBe("MOB")
  })
})

function createTestAppState(overrides: Partial<WorkspaceSource> = {}, saveWorkspaceConfig: (workspace: JiraWorkspaceConfig) => Promise<unknown> = async () => undefined) {
  let appState: AppStateContext | undefined
  let dispose: (() => void) | undefined
  createRoot((disposeRoot) => {
    dispose = disposeRoot
    disposers.push(disposeRoot)
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const source: WorkspaceSource = {
      env: "dev",
      async fetchProjects() {
        return [...devProjects]
      },
      async fetchBoards(projectKeyOrId) {
        const project = devProjects.find((candidate) => candidate.key === projectKeyOrId || candidate.id === projectKeyOrId)
        return [...(devBoardsByProjectKey[project?.key ?? projectKeyOrId] ?? [])]
      },
      async loadWorkspace(selection) {
        return loadDevWorkspaceFixture(selection.project.key)
      },
      ...overrides,
    }
    createComponent(ToastProvider, {
      get children() {
        return createComponent(AppStateProvider, {
          initialState: createInitialAppState(loadDevWorkspaceFixture("PROJ"), "dev"),
          source,
          saveWorkspaceConfig,
          get children() {
            return createComponent(Capture, {})
          },
        })
      },
    })
  })
  if (!appState) {
    dispose?.()
    throw new Error("App state test context was not initialized")
  }
  return appState
}
