import { afterEach, describe, expect, test } from "bun:test"
import { createComponent, createRoot } from "solid-js"
import { ToastProvider } from "./toast"
import { AppStateProvider, useAppState, type AppStateContext } from "./app-state"
import { createInitialAppState } from "../state/initial"
import { backlogIssuePageSourceId, boardIssuePageSourceId, remoteSearchIssuePageSourceId, sprintIssuePageSourceId } from "../state/issue-pages"
import { stagedChanges } from "../state/staged-changes"
import { devBoardsByProjectKey, devProjects, loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import type { LoadedIssueDetail, WorkspaceSource } from "../workspace/types"
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

  test("allows focusing read-only config rows for scrolling", () => {
    const appState = createTestAppState()

    appState.setRoute("config")
    appState.moveConfigSelection(4)
    appState.focusConfigArea("rows")
    appState.moveConfigSelection(1)

    expect(appState.state.configFocusedArea).toBe("rows")
    expect(appState.state.configSelectedSectionIndex).toBe(4)
    expect(appState.state.configSelectedRowIndex).toBe(1)
  })

  test("loads issue detail when opening an issue", async () => {
    let loadedIssueKey = ""
    const appState = createTestAppState({
      async loadIssueDetail(issueKey, context) {
        loadedIssueKey = issueKey
        return { issue: { ...context.existingIssue!, description: "Loaded Jira detail", comments: [{ id: "c1", author: "Mina", body: "Ready to verify", age: "2026-07-24" }] } }
      },
    })

    appState.openIssueDetail("PROJ-128")
    await flushPromises()

    expect(loadedIssueKey).toBe("PROJ-128")
    expect(appState.state.issueDetailLoadingByKey["PROJ-128"]).toBe(false)
    expect(appState.state.issueDetailErrorByKey["PROJ-128"]).toBeUndefined()
    expect(appState.state.issueDetailLoadedAtByKey["PROJ-128"]).toBeTruthy()
    expect(appState.state.issues["PROJ-128"]?.description).toBe("Loaded Jira detail")
    expect(appState.state.issues["PROJ-128"]?.comments[0]?.body).toBe("Ready to verify")
  })

  test("keeps staged overlays after issue detail refresh", async () => {
    const appState = createTestAppState({
      async loadIssueDetail(issueKey, context) {
        return { issue: { ...context.existingIssue!, title: "Fresh Jira summary" } }
      },
    })

    appState.selectIssue("PROJ-128")
    appState.startInspectorEdit()
    appState.updateInspectorEditValue("Local staged summary")
    appState.commitInspectorEdit()
    await appState.loadIssueDetail("PROJ-128")

    expect(appState.state.issues["PROJ-128"]?.title).toBe("Fresh Jira summary")
    expect(appState.state.issueDrafts["PROJ-128"]?.title).toBe("Local staged summary")
  })

  test("ignores stale issue detail responses", async () => {
    const first = deferred<LoadedIssueDetail>()
    const second = deferred<LoadedIssueDetail>()
    const appState = createTestAppState({
      async loadIssueDetail(issueKey, context) {
        if (issueKey === "PROJ-128") return first.promise
        if (issueKey === "PROJ-121") return second.promise
        return { issue: context.existingIssue! }
      },
    })

    const originalTitle = appState.state.issues["PROJ-128"]?.title
    appState.openIssueDetail("PROJ-128")
    appState.openIssueDetail("PROJ-121")
    second.resolve({ issue: { ...appState.state.issues["PROJ-121"]!, title: "Current detail" } })
    await flushPromises()
    first.resolve({ issue: { ...appState.state.issues["PROJ-128"]!, title: "Stale detail" } })
    await flushPromises()

    expect(appState.state.issues["PROJ-121"]?.title).toBe("Current detail")
    expect(appState.state.issues["PROJ-128"]?.title).toBe(originalTitle)
  })

  test("appends issue pages without clearing staged overlays or loaded comments", async () => {
    const duplicate = loadDevWorkspaceFixture("PROJ").issues["PROJ-128"]!
    const appended = { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!, key: "PROJ-999", title: "New page issue", sprintId: undefined }
    const appState = createTestAppState({
      async loadIssueDetail(issueKey, context) {
        return { issue: { ...context.existingIssue!, key: issueKey, comments: [{ id: "c1", author: "Mina", body: "Loaded detail comment", age: "2026-07-24" }] } }
      },
      async loadIssuePage(sourceId, context) {
        expect(sourceId).toBe(boardIssuePageSourceId)
        expect(context.pageState.startAt).toBe(0)
        return {
          sourceId,
          issues: [{ ...duplicate, title: "Updated from page", comments: [] }, appended],
          pageState: { sourceId, startAt: 2, maxResults: context.pageState.maxResults, total: 2, isLast: true, loading: false },
        }
      },
    })

    appState.openIssueDetail("PROJ-128")
    await flushPromises()
    appState.selectIssue("PROJ-128")
    appState.startInspectorEdit()
    appState.updateInspectorEditValue("Local staged summary")
    appState.commitInspectorEdit()
    await appState.loadIssuePage(boardIssuePageSourceId)

    expect(appState.state.issues["PROJ-128"]?.title).toBe("Updated from page")
    expect(appState.state.issues["PROJ-128"]?.comments[0]?.body).toBe("Loaded detail comment")
    expect(appState.state.issueDrafts["PROJ-128"]?.title).toBe("Local staged summary")
    expect(appState.state.issues["PROJ-999"]?.title).toBe("New page issue")
    expect(appState.state.issuePageStateBySource[boardIssuePageSourceId]).toMatchObject({ startAt: 2, total: 2, isLast: true, loading: false })
  })

  test("tracks draft issue creation as staged and discards it", () => {
    const draft = { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!, key: "DRAFT-1", title: "New issue", isDraft: true }
    const appState = createTestAppState()

    appState.createDraftIssue(draft)
    expect(stagedChanges(appState.state).map((change) => change.id)).toContain("create:DRAFT-1")
    expect(appState.state.selectedIssueKey).toBe("DRAFT-1")

    appState.openStagedDiscard()
    appState.confirmStagedDiscard()

    expect(appState.state.issues["DRAFT-1"]).toBeUndefined()
    expect(appState.state.issueDrafts["DRAFT-1"]).toBeUndefined()
    expect(appState.state.selectedIssueKey).not.toBe("DRAFT-1")
    expect(stagedChanges(appState.state).some((change) => change.id === "create:DRAFT-1")).toBe(false)
  })

  test("keeps slash filtering local and runs remote search separately", async () => {
    let searchCalls = 0
    const first = loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!
    const second = { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-128"]!, key: "PROJ-998", title: "Second remote page" }
    const appState = createTestAppState({
      async searchIssues(query, context) {
        searchCalls += 1
        const issue = context.pageState.startAt === 0 ? first : second
        return {
          query,
          issues: [issue],
          pageState: { sourceId: remoteSearchIssuePageSourceId, startAt: context.pageState.startAt + 1, maxResults: context.pageState.maxResults, total: 2, isLast: context.pageState.startAt > 0, loading: false },
        }
      },
    })

    appState.openSearch()
    appState.updateSearchDraft("auth")
    appState.commitSearch()
    await flushPromises()
    expect(searchCalls).toBe(0)
    expect(appState.state.searchQuery).toBe("auth")

    appState.openRemoteSearch()
    appState.updateSearchDraft("login")
    appState.commitSearch()
    await flushPromises()
    expect(searchCalls).toBe(1)
    expect(appState.state.searchQuery).toBe("auth")
    expect(appState.state.remoteSearchQuery).toBe("login")
    expect(appState.state.remoteSearchIssueKeys).toEqual(["PROJ-121"])
    expect(appState.state.route).toBe("workspace")

    await appState.loadMoreRemoteSearch()
    expect(searchCalls).toBe(2)
    expect(appState.state.remoteSearchIssueKeys).toEqual(["PROJ-121", "PROJ-998"])
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
      async loadIssueDetail(issueKey, context) {
        const issue = context.existingIssue ?? loadDevWorkspaceFixture(context.project.key).issues[issueKey]
        if (!issue) throw new Error(`Missing fixture issue ${issueKey}`)
        return { issue }
      },
      async loadIssuePage(sourceId, context) {
        const issues = Object.values(loadDevWorkspaceFixture(context.project.key).issues).filter((issue) => issueInSource(issue.sprintId, sourceId))
        const startAt = context.pageState.startAt
        const maxResults = context.pageState.maxResults
        const items = issues.slice(startAt, startAt + maxResults)
        const nextStartAt = startAt + items.length
        return { sourceId, issues: items, pageState: { sourceId, startAt: nextStartAt, maxResults, total: issues.length, isLast: nextStartAt >= issues.length, loading: false } }
      },
      async searchIssues(query, context) {
        const normalized = query.trim().toLowerCase()
        const issues = Object.values(loadDevWorkspaceFixture(context.project.key).issues).filter((issue) => `${issue.key} ${issue.title} ${issue.description}`.toLowerCase().includes(normalized))
        const startAt = context.pageState.startAt
        const maxResults = context.pageState.maxResults
        const items = issues.slice(startAt, startAt + maxResults)
        const nextStartAt = startAt + items.length
        return { query, issues: items, pageState: { sourceId: remoteSearchIssuePageSourceId, startAt: nextStartAt, maxResults, total: issues.length, isLast: nextStartAt >= issues.length, loading: false } }
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

function issueInSource(sprintId: string | undefined, sourceId: string) {
  if (sourceId === boardIssuePageSourceId) return true
  if (sourceId === backlogIssuePageSourceId) return !sprintId
  if (sourceId.startsWith("sprint:")) return sourceId === sprintIssuePageSourceId(sprintId ?? "")
  return false
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}
