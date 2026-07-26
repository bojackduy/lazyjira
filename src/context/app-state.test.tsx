import { afterEach, describe, expect, test } from "bun:test"
import { createComponent, createRoot } from "solid-js"
import { ToastProvider } from "./toast"
import { AppStateProvider, useAppState, type AppStateContext } from "./app-state"
import { createInitialAppState } from "../state/initial"
import { backlogIssuePageSourceId, boardIssuePageSourceId, remoteSearchIssuePageSourceId, sprintIssuePageSourceId } from "../state/issue-pages"
import { stagedChanges } from "../state/staged-changes"
import { devBoardsByProjectKey, devProjects, loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import type { LoadedIssueDetail, WorkspaceSelection, WorkspaceSource } from "../workspace/types"
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

  test("stages comments and backlog rank operations", () => {
    const appState = createTestAppState()

    appState.startComment()
    appState.updateCommentValue("Ready for review")
    appState.commitComment()
    appState.stageIssueRank("PROJ-128", "PROJ-121", "after")

    expect(appState.state.commentDrafts).toEqual([{ id: "comment-1", issueKey: "PROJ-128", body: "Ready for review" }])
    expect(appState.state.rankDrafts["PROJ-128"]).toEqual({ issueKey: "PROJ-128", targetIssueKey: "PROJ-121", position: "after" })
  })

  test("loads a saved workspace after the provider mounts", async () => {
    const initialLoad = deferred<ReturnType<typeof loadDevWorkspaceFixture>>()
    let loadCalls = 0
    const appState = createTestAppState({
      async loadWorkspace() {
        loadCalls += 1
        return initialLoad.promise
      },
    }, async () => undefined, savedWorkspaceSelection())

    expect(loadCalls).toBe(1)
    expect(appState.state.workspaceLoading).toBe(true)

    initialLoad.resolve(loadDevWorkspaceFixture("MOB"))
    await flushPromises()

    expect(appState.state.workspaceLoading).toBe(false)
    expect(appState.state.workspaceLoadError).toBeUndefined()
    expect(appState.state.project.key).toBe("MOB")
  })

  test("keeps the shell state available after initial workspace load failure and retries", async () => {
    let loadCalls = 0
    const appState = createTestAppState({
      async loadWorkspace() {
        loadCalls += 1
        if (loadCalls === 1) throw new Error("Jira is unavailable")
        return loadDevWorkspaceFixture("MOB")
      },
    }, async () => undefined, savedWorkspaceSelection())

    await flushPromises()
    expect(appState.state.workspaceLoading).toBe(false)
    expect(appState.state.workspaceLoadError).toBe("Jira is unavailable")

    appState.retryWorkspaceLoad()
    await flushPromises()

    expect(loadCalls).toBe(2)
    expect(appState.state.workspaceLoadError).toBeUndefined()
    expect(appState.state.project.key).toBe("MOB")
  })

  test("ignores a stale startup workspace response after switching workspaces", async () => {
    const startupLoad = deferred<ReturnType<typeof loadDevWorkspaceFixture>>()
    const switchedLoad = deferred<ReturnType<typeof loadDevWorkspaceFixture>>()
    const appState = createTestAppState({
      async loadWorkspace(selection) {
        return selection.project.key === "PROJ" ? startupLoad.promise : switchedLoad.promise
      },
    }, async () => undefined, savedWorkspaceSelection())

    await appState.browseRemoteProjects()
    appState.moveProjectPickerSelection(1)
    await appState.selectProjectPickerItem()
    const switchPromise = appState.selectProjectPickerItem()
    switchedLoad.resolve(loadDevWorkspaceFixture("MOB"))
    await switchPromise

    startupLoad.resolve(loadDevWorkspaceFixture("PROJ"))
    await flushPromises()

    expect(appState.state.project.key).toBe("MOB")
    expect(appState.state.workspaceLoading).toBe(false)
  })

  test("keeps loaded workspace data visible while refreshing and after refresh failure", async () => {
    const refresh = deferred<ReturnType<typeof loadDevWorkspaceFixture>>()
    const appState = createTestAppState({
      async loadWorkspace() {
        return refresh.promise
      },
    }, async () => undefined, undefined, true)
    const originalTitle = appState.state.issues["PROJ-128"]?.title

    appState.refreshWorkspace()
    expect(appState.state.workspaceLoading).toBe(true)
    expect(appState.state.issues["PROJ-128"]?.title).toBe(originalTitle)

    refresh.reject(new Error("Jira timed out"))
    await flushPromises()

    expect(appState.state.workspaceLoading).toBe(false)
    expect(appState.state.workspaceLoadError).toBe("Jira timed out")
    expect(appState.state.issues["PROJ-128"]?.title).toBe(originalTitle)
  })

  test("replaces loaded workspace data only after a successful refresh", async () => {
    const refresh = deferred<ReturnType<typeof loadDevWorkspaceFixture>>()
    const appState = createTestAppState({
      async loadWorkspace() {
        return refresh.promise
      },
    }, async () => undefined, undefined, true)

    appState.refreshWorkspace()
    refresh.resolve({
      ...loadDevWorkspaceFixture("PROJ"),
      issues: {
        ...loadDevWorkspaceFixture("PROJ").issues,
        "PROJ-128": { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-128"]!, title: "Fresh Jira summary" },
      },
    })
    await flushPromises()

    expect(appState.state.workspaceLoading).toBe(false)
    expect(appState.state.workspaceLoadError).toBeUndefined()
    expect(appState.state.issues["PROJ-128"]?.title).toBe("Fresh Jira summary")
  })

  test("keeps the active workspace when a project switch fails", async () => {
    let loadCalls = 0
    const appState = createTestAppState({
      async loadWorkspace() {
        loadCalls += 1
        throw new Error("Selected board is unavailable")
      },
    })
    const originalTitle = appState.state.issues["PROJ-128"]?.title

    await appState.browseRemoteProjects()
    appState.moveProjectPickerSelection(1)
    await appState.selectProjectPickerItem()
    await appState.selectProjectPickerItem()

    expect(loadCalls).toBe(1)
    expect(appState.state.project.key).toBe("PROJ")
    expect(appState.state.board.id).toBe("dev-board-proj")
    expect(appState.state.issues["PROJ-128"]?.title).toBe(originalTitle)
    expect(appState.state.workspaceLoadError).toBe("Selected board is unavailable")
    expect(appState.state.projectPicker.error).toBe("Selected board is unavailable")
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

function createTestAppState(overrides: Partial<WorkspaceSource> = {}, saveWorkspaceConfig: (workspace: JiraWorkspaceConfig) => Promise<unknown> = async () => undefined, initialWorkspaceSelection?: WorkspaceSelection, initialWorkspaceReady = false) {
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
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.jiraProjectReady = initialWorkspaceReady
    createComponent(ToastProvider, {
      get children() {
        return createComponent(AppStateProvider, {
          initialState,
          initialWorkspaceSelection,
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

function savedWorkspaceSelection(): WorkspaceSelection {
  return {
    project: { key: "PROJ", name: "Product Platform" },
    board: { id: "dev-board-proj", name: "Product Kanban", type: "kanban" },
  }
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
