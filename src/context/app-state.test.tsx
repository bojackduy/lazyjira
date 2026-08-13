import { afterEach, describe, expect, test } from "bun:test"
import { createComponent, createRoot } from "solid-js"
import { ToastProvider } from "./toast"
import { AppStateProvider, useAppState, type AppStateContext } from "./app-state"
import { createInitialAppState } from "../state/initial"
import { backlogIssuePageSourceId, boardIssuePageSourceId, projectListIssuePageSourceId, remoteSearchIssuePageSourceId, sprintIssuePageSourceId } from "../state/issue-pages"
import { stagedChanges } from "../state/staged-changes"
import { devBoardsByProjectKey, devProjects, loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import type { LoadedIssueDetail, WorkspaceSelection, WorkspaceSource } from "../workspace/types"
import type { JiraWorkspaceConfig } from "../auth/config"
import { issueFields } from "../state/issue-fields"
import { timelineCreateRowKey, timelineLoadMoreRowKey, timelineUnparentedSectionKey } from "../state/timeline"
import { projectListLoadMoreRowKey } from "../state/project-list"
import { groupBacklogIssues } from "../state/selectors"

const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length) disposers.pop()?.()
})

describe("app state project picker", () => {
  test("focuses the main pane when changing project routes", () => {
    const appState = createTestAppState()
    appState.setFocusedPane("inspector")
    appState.setSelectedBacklogGroup("sprint-26")
    appState.selectIssue("LIST-ONLY")

    appState.setRoute("backlog")

    expect(appState.state.route).toBe("backlog")
    expect(appState.state.focusedPane).toBe("main")
    expect(appState.state.selectedBacklogGroupId).not.toBe("sprint-26")
    expect(appState.state.selectedIssueKey).not.toBe("LIST-ONLY")
  })

  test("allows route changes while a Backlog page is loading", async () => {
    const backlogPage = deferred<Awaited<ReturnType<WorkspaceSource["loadIssuePage"]>>>()
    const appState = createTestAppState({
      async loadIssuePage(sourceId) {
        if (sourceId === backlogIssuePageSourceId) return backlogPage.promise
        return { sourceId, issues: [], pageState: { sourceId, startAt: 0, maxResults: 50, total: 0, isLast: true, loading: false } }
      },
    })
    const load = appState.loadIssuePage(backlogIssuePageSourceId)

    appState.setRoute("timeline")

    expect(appState.state.route).toBe("timeline")
    expect(appState.state.focusedPane).toBe("main")
    backlogPage.resolve({ sourceId: backlogIssuePageSourceId, issues: [], pageState: { sourceId: backlogIssuePageSourceId, startAt: 0, maxResults: 100, total: 0, isLast: true, loading: false } })
    await load
    expect(appState.state.route).toBe("timeline")
  })

  test("loads project List when it is the persisted initial route", async () => {
    let listLoads = 0
    createTestAppState({
      async loadIssuePage(sourceId, context) {
        listLoads += 1
        return { sourceId, issues: [], pageState: { ...context.pageState, isLast: true, loading: false, total: 0 } }
      },
    }, async () => undefined, undefined, true, "list")

    await flushPromises()

    expect(listLoads).toBe(1)
  })

  test("opens local workspace switcher without fetching remote projects", () => {
    let projectPageFetchCount = 0
    const appState = createTestAppState({
      async fetchProjectPage({ query, startAt, maxResults }) {
        projectPageFetchCount += 1
        return projectPage(query, startAt, maxResults)
      },
    })

    appState.openProjectPicker()

    expect(appState.state.projectPicker.open).toBe(true)
    expect(appState.state.projectPicker.mode).toBe("local")
    expect(projectPageFetchCount).toBe(0)
  })

  test("opens local workspace switcher even before prod auth is ready", () => {
    let projectPageFetchCount = 0
    const appState = createTestAppState({
      env: "prod",
      async fetchProjectPage({ query, startAt, maxResults }) {
        projectPageFetchCount += 1
        return projectPage(query, startAt, maxResults)
      },
    })

    appState.openProjectPicker()

    expect(appState.state.projectPicker.open).toBe(true)
    expect(appState.state.projectPicker.mode).toBe("local")
    expect(appState.state.authOnboarding.open).toBe(false)
    expect(projectPageFetchCount).toBe(0)
  })

  test("remote browse fetches project cache only on demand", async () => {
    let projectPageFetchCount = 0
    const appState = createTestAppState({
      async fetchProjectPage({ query, startAt, maxResults }) {
        projectPageFetchCount += 1
        return projectPage(query, startAt, maxResults)
      },
    })

    await appState.browseRemoteProjects()
    await appState.browseRemoteProjects()

    expect(appState.state.projectPicker.mode).toBe("remote-projects")
    expect(appState.state.projectPicker.remoteProjectPage?.items.map((project) => project.key)).toEqual(["PROJ", "MOB", "OPS"])
    expect(projectPageFetchCount).toBe(1)
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
    expect(appState.state.projectPicker.remoteProjectPage?.items.map((project) => project.key)).toEqual(["PROJ", "MOB", "OPS"])
    expect(appState.state.projectPicker.selectedIndex).toBe(0)
    await appState.selectProjectPickerItem()
    expect(appState.state.projectPicker.remoteBoardsByProject.PROJ?.map((board) => board.id)).toEqual(["dev-board-proj"])

    expect(loadWorkspaceCount).toBe(0)
    expect(savedWorkspaces).toEqual([{ projectKey: "PROJ", projectName: "Product Platform", boardId: "dev-board-proj", boardName: "Product Kanban", boardType: "kanban", route: "board" }])
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
        return [...devBoardsByProjectKey.MOB!, { id: "dev-board-mob-scrum", name: "Mobile Scrum", type: "scrum" }]
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

  test("auto-selects the observed HPCE Scrum board 8608", async () => {
    const savedWorkspaces: JiraWorkspaceConfig[] = []
    const appState = createTestAppState({
      async fetchProjectPage({ startAt, maxResults }) {
        return { items: [{ id: "10000", key: "HPCE", name: "Health Platform" }], startAt, maxResults, total: 1, isLast: true }
      },
      async fetchBoards(projectKeyOrId) {
        expect(projectKeyOrId).toBe("HPCE")
        return [{ id: "8608", name: "HPCE Scrum", type: "scrum" }]
      },
      async loadWorkspace(selection) {
        return { ...loadDevWorkspaceFixture("PROJ"), project: selection.project, board: selection.board }
      },
    }, async (workspace) => savedWorkspaces.push(workspace))

    await appState.browseRemoteProjects()
    await appState.selectProjectPickerItem()

    expect(appState.state.projectPicker.open).toBe(false)
    expect(appState.state.project.key).toBe("HPCE")
    expect(appState.state.board).toMatchObject({ id: "8608", type: "scrum" })
    expect(savedWorkspaces[0]).toMatchObject({ projectKey: "HPCE", boardId: "8608", boardType: "scrum" })
  })

  test("keeps zero-board projects blocked with a clear retryable error", async () => {
    let boardLoads = 0
    let workspaceLoads = 0
    const appState = createTestAppState({
      async fetchBoards() {
        boardLoads += 1
        return []
      },
      async loadWorkspace(selection) {
        workspaceLoads += 1
        return loadDevWorkspaceFixture(selection.project.key)
      },
    })

    await appState.browseRemoteProjects()
    await appState.selectProjectPickerItem()
    await appState.selectProjectPickerItem()

    expect(appState.state.projectPicker.mode).toBe("remote-projects")
    expect(appState.state.projectPicker.error).toBe("No Jira Software boards found for PROJ")
    expect(boardLoads).toBe(2)
    expect(workspaceLoads).toBe(0)
  })

  test("caches visited project pages and restores project selection after the board chooser", async () => {
    const offsets: number[] = []
    const projects = Array.from({ length: 75 }, (_, index) => ({ id: String(index), key: `P${index}`, name: `Project ${index}` }))
    const appState = createTestAppState({
      async fetchProjectPage({ query, startAt, maxResults }) {
        offsets.push(startAt)
        const items = projects.slice(startAt, startAt + maxResults)
        return { items, startAt, maxResults, total: projects.length, isLast: startAt + items.length >= projects.length }
      },
      async fetchBoards() {
        return [{ id: "1", name: "Scrum", type: "scrum" }, { id: "2", name: "Kanban", type: "kanban" }]
      },
    })

    await appState.browseRemoteProjects()
    await appState.changeProjectPickerPage(1)
    appState.moveProjectPickerSelection(4)
    await appState.selectProjectPickerItem()
    expect(appState.state.projectPicker.mode).toBe("remote-boards")

    appState.backProjectPickerStep()
    expect(appState.state.projectPicker.remoteProjectPage?.startAt).toBe(50)
    expect(appState.state.projectPicker.selectedIndex).toBe(4)
    await appState.changeProjectPickerPage(-1)
    await appState.changeProjectPickerPage(1)
    expect(offsets).toEqual([0, 50])
  })

  test("debounces server-side project search and ignores stale responses", async () => {
    const searches: string[] = []
    const first = deferred<ReturnType<typeof projectPage>>()
    const appState = createTestAppState({
      async fetchProjectPage({ query, startAt, maxResults }) {
        if (!query) return projectPage(query, startAt, maxResults)
        searches.push(query)
        if (query === "mobile") return first.promise
        return { items: [{ id: "ops", key: "OPS", name: "Operations" }], startAt: 0, maxResults, total: 1, isLast: true }
      },
    })

    await appState.browseRemoteProjects()
    appState.updateProjectPickerSearch("mob")
    appState.updateProjectPickerSearch("mobile")
    await delay(300)
    appState.updateProjectPickerSearch("operations")
    await delay(300)

    expect(searches).toEqual(["mobile", "operations"])
    expect(appState.state.projectPicker.remoteProjectPage?.items[0]?.key).toBe("OPS")
    first.resolve({ items: [{ id: "mob", key: "MOB", name: "Mobile" }], startAt: 0, maxResults: 50, total: 1, isLast: true })
    await flushPromises()
    expect(appState.state.projectPicker.remoteProjectPage?.items[0]?.key).toBe("OPS")
  })

  test("keeps the previous successful project page when paging fails", async () => {
    const appState = createTestAppState({
      async fetchProjectPage({ query, startAt, maxResults }) {
        if (startAt) throw new Error("Project page unavailable")
        return { ...projectPage(query, startAt, maxResults), total: 75, isLast: false }
      },
    })

    await appState.browseRemoteProjects()
    const keys = appState.state.projectPicker.remoteProjectPage?.items.map((project) => project.key)
    await appState.changeProjectPickerPage(1)

    expect(appState.state.projectPicker.remoteProjectPage?.items.map((project) => project.key)).toEqual(keys)
    expect(appState.state.projectPicker.error).toBe("Project page unavailable")
  })

  test("treats an empty server-side project search as a valid result", async () => {
    const appState = createTestAppState({
      async fetchProjectPage({ query, startAt, maxResults }) {
        if (!query) return projectPage(query, startAt, maxResults)
        return { items: [], startAt, maxResults, total: 0, isLast: true }
      },
    })

    await appState.browseRemoteProjects()
    appState.updateProjectPickerSearch("no matching project")
    await delay(300)

    expect(appState.state.projectPicker.remoteProjectPage?.items).toEqual([])
    expect(appState.state.projectPicker.remoteProjectPage?.total).toBe(0)
    expect(appState.state.projectPicker.remoteProjectPage?.isLast).toBe(true)
    expect(appState.state.projectPicker.error).toBeUndefined()
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

  test("preserves sidebar quick-filter selection when toggling it", () => {
    const appState = createTestAppState()
    appState.setFocusedPane("sidebar")
    appState.moveSidebarSelection(1)

    expect(appState.state.sidebarSelectedIndex).toBe(5)
    appState.toggleSidebarFilterSelection()

    expect(appState.state.sidebarSelectedIndex).toBe(5)
    expect(appState.state.activeQuickFilters).toEqual(["mine"])
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

  test("opens an unloaded parent from detail and returns through issue history", async () => {
    const childKey = "PROJ-121"
    const parentKey = "PROJ-999"
    const loadedKeys: string[] = []
    const appState = createTestAppState({
      async loadIssueDetail(issueKey, context) {
        loadedKeys.push(issueKey)
        if (issueKey === childKey) return { issue: { ...context.existingIssue!, parentKey, parent: { key: parentKey, title: "Direct parent", type: "Feature", typeHierarchyLevel: 1 } } }
        return { issue: { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-101"]!, key: parentKey, title: "Direct parent", type: "Feature", typeHierarchyLevel: 1 } }
      },
    })
    const originalRoute = appState.state.route

    appState.openIssueDetail(childKey)
    await flushPromises()
    appState.openParentIssue()
    await flushPromises()

    expect(loadedKeys).toEqual([childKey, parentKey])
    expect(appState.state.selectedIssueKey).toBe(parentKey)
    expect(appState.state.issueDetailHistory).toEqual([childKey])
    expect(Object.values(appState.state.issueKeysBySource).flat()).not.toContain(parentKey)

    appState.closeIssueDetail()
    expect(appState.state.route).toBe("issue-detail")
    expect(appState.state.selectedIssueKey).toBe(childKey)
    appState.closeIssueDetail()
    expect(appState.state.route).toBe(originalRoute)
  })

  test("returns through issue history after opening an in-detail link and resets focus mode", async () => {
    const firstKey = "PROJ-121"
    const linkedKey = "PROJ-998"
    const loadedKeys: string[] = []
    const appState = createTestAppState({
      async loadIssueDetail(issueKey, context) {
        loadedKeys.push(issueKey)
        return { issue: { ...context.existingIssue ?? loadDevWorkspaceFixture("PROJ").issues["PROJ-101"]!, key: issueKey, title: `Loaded ${issueKey}` } }
      },
    })
    const originalRoute = appState.state.route

    appState.openIssueDetail(firstKey)
    await flushPromises()
    appState.setDetailSectionFocus(true)
    appState.openIssueDetail(linkedKey)
    await flushPromises()

    expect(appState.state.selectedIssueKey).toBe(linkedKey)
    expect(appState.state.detailSectionFocus).toBe(false)
    expect(appState.state.issueDetailHistory).toEqual([firstKey])

    appState.closeIssueDetail()
    expect(appState.state.route).toBe("issue-detail")
    expect(appState.state.selectedIssueKey).toBe(firstKey)
    appState.closeIssueDetail()
    expect(appState.state.route).toBe(originalRoute)
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
    expect(appState.state.issueKeysBySource[boardIssuePageSourceId]?.filter((key) => key === "PROJ-999")).toEqual(["PROJ-999"])
    expect(appState.state.issueKeysBySource[boardIssuePageSourceId]?.filter((key) => key === "PROJ-128")).toEqual(["PROJ-128"])
    expect(appState.state.issueKeysBySource[backlogIssuePageSourceId]).not.toContain("PROJ-999")
  })

  test("loads project List on first entry, appends with dedupe, and preserves view state", async () => {
    let calls = 0
    const first = loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!
    const second = loadDevWorkspaceFixture("PROJ").issues["PROJ-128"]!
    const appState = createTestAppState({
      async loadIssuePage(sourceId, context) {
        calls += 1
        expect(sourceId).toBe(projectListIssuePageSourceId)
        if (calls === 1) return {
          sourceId,
          issues: [first],
          pageState: { sourceId, startAt: 1, cursor: "list-2", maxResults: 50, total: 3, isLast: false, loading: false },
          sort: "rank",
        }
        return {
          sourceId,
          issues: [{ ...first, title: "Fresh OAuth summary" }, second],
          pageState: { sourceId, startAt: 3, maxResults: 50, total: 3, isLast: true, loading: false },
          sort: "rank",
        }
      },
    })

    expect(appState.state.issuePageStateBySource[projectListIssuePageSourceId]).toBeUndefined()
    const boardKeys = [...(appState.state.issueKeysBySource[boardIssuePageSourceId] ?? [])]
    appState.setRoute("list")
    await flushPromises()
    appState.setProjectListSelection("PROJ-121")
    appState.setProjectListHorizontalOffset(2)
    appState.openSearch()
    appState.updateSearchDraft("oauth")
    appState.commitSearch()
    appState.setProjectListSelection(projectListLoadMoreRowKey)
    await appState.loadIssuePage(projectListIssuePageSourceId)

    expect(calls).toBe(2)
    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toEqual(["PROJ-121", "PROJ-128"])
    expect(appState.state.issueKeysBySource[boardIssuePageSourceId]).toEqual(boardKeys)
    expect(appState.state.projectListSelectedIssueKey).toBe("PROJ-128")
    expect(appState.state.selectedIssueKey).toBe("PROJ-128")
    expect(appState.state.projectListHorizontalOffset).toBe(2)
    expect(appState.state.searchQuery).toBe("oauth")
    expect(appState.state.issues["PROJ-121"]?.title).toBe("Fresh OAuth summary")
  })

  test("retains project List rows, selection, filter, and cursor after append failure", async () => {
    let calls = 0
    const issue = loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!
    const appState = createTestAppState({
      async loadIssuePage(sourceId) {
        calls += 1
        if (calls > 1) throw new Error("Jira 403: Project issue access denied")
        return { sourceId, issues: [issue], pageState: { sourceId, startAt: 1, cursor: "retry-cursor", maxResults: 50, total: 2, isLast: false, loading: false } }
      },
    })

    appState.setRoute("list")
    await flushPromises()
    const selectedIssueKey = appState.state.selectedIssueKey
    appState.setProjectListSelection(projectListLoadMoreRowKey)
    appState.openSearch()
    appState.updateSearchDraft("oauth")
    appState.commitSearch()
    await appState.loadIssuePage(projectListIssuePageSourceId)

    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toEqual([issue.key])
    expect(appState.state.projectListSelectedIssueKey).toBe(projectListLoadMoreRowKey)
    expect(appState.state.selectedIssueKey).toBe(selectedIssueKey)
    expect(appState.state.searchQuery).toBe("oauth")
    expect(appState.state.issuePageStateBySource[projectListIssuePageSourceId]).toMatchObject({ startAt: 1, cursor: "retry-cursor", error: "Jira 403: Project issue access denied", loading: false })
  })

  test("merges parent hydration without adding parents to List membership and keeps nonfatal metadata", async () => {
    const child = { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!, parentKey: "PROJ-500" }
    const parent = { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-101"]!, key: "PROJ-500", title: "Hydrated parent" }
    const appState = createTestAppState({
      async loadIssuePage(sourceId) {
        return {
          sourceId,
          issues: [child],
          relatedIssues: [parent],
          pageState: { sourceId, startAt: 1, maxResults: 50, total: 1, isLast: true, loading: false },
          timelineStartDateField: { status: "unavailable", reason: "ambiguous", candidateIds: ["a", "b"] },
          parentHydrationError: "Parent hydration failed: Jira 403",
        }
      },
    })

    appState.setRoute("timeline")
    await flushPromises()

    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toEqual([child.key])
    expect(appState.state.issues[parent.key]?.title).toBe("Hydrated parent")
    expect(appState.state.collapsedTimelineParentKeys).toContain(parent.key)
    expect(appState.state.timelineStartDateField).toMatchObject({ status: "unavailable", reason: "ambiguous" })
    expect(appState.state.timelineParentHydrationError).toBe("Parent hydration failed: Jira 403")
  })

  test("preserves Timeline selection and date window across project views and issue detail return", async () => {
    const appState = createTestAppState()
    appState.setRoute("timeline")
    await flushPromises()
    appState.setTimelineSelection("PROJ-301")
    appState.setTimelineWindowStart("2026-08-03")
    appState.setTimelineZoom("month")
    expect(appState.state.collapsedTimelineParentKeys).toContain("PROJ-301")
    appState.toggleTimelineParentCollapsed("PROJ-301")

    appState.setRoute("list")
    appState.setRoute("timeline")
    appState.openIssueDetail("PROJ-301")
    await flushPromises()
    appState.closeIssueDetail()

    expect(appState.state.route).toBe("timeline")
    expect(appState.state.timelineSelectedIssueKey).toBe("PROJ-301")
    expect(appState.state.selectedIssueKey).toBe("PROJ-301")
    expect(appState.state.timelineWindowStart).toBe("2026-08-03")
    expect(appState.state.timelineZoom).toBe("month")
    expect(appState.state.collapsedTimelineParentKeys).not.toContain("PROJ-301")
  })

  test("keeps virtual Timeline rows out of shared issue selection", () => {
    const appState = createTestAppState()
    const selectedIssueKey = appState.state.selectedIssueKey

    appState.setTimelineSelection(timelineUnparentedSectionKey)
    expect(appState.state.timelineSelectedIssueKey).toBe(timelineUnparentedSectionKey)
    expect(appState.state.selectedIssueKey).toBe(selectedIssueKey)

    appState.setTimelineSelection(timelineCreateRowKey)
    expect(appState.state.timelineSelectedIssueKey).toBe(timelineCreateRowKey)
    expect(appState.state.selectedIssueKey).toBe(selectedIssueKey)

    appState.setTimelineSelection(timelineLoadMoreRowKey)
    expect(appState.state.timelineSelectedIssueKey).toBe(timelineLoadMoreRowKey)
    expect(appState.state.selectedIssueKey).toBe(selectedIssueKey)
  })

  test("resets independent Timeline view state after switching projects", async () => {
    const appState = createTestAppState()
    appState.setTimelineSelection("PROJ-301")
    appState.setTimelineWindowStart("2026-08-03")
    appState.setTimelineZoom("month")
    appState.toggleTimelineParentCollapsed("PROJ-301")

    await appState.browseRemoteProjects()
    appState.moveProjectPickerSelection(1)
    await appState.selectProjectPickerItem()
    await appState.selectProjectPickerItem()

    expect(appState.state.project.key).toBe("MOB")
    expect(appState.state.timelineSelectedIssueKey).toBeUndefined()
    expect(appState.state.timelineZoom).toBe("month")
    expect(appState.state.collapsedTimelineParentKeys).toEqual([])
    expect(appState.state.timelineWindowStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test("keeps List collapse independent and resets it after switching projects", async () => {
    const appState = createTestAppState()
    appState.toggleProjectListParentCollapsed("PROJ-300")

    expect(appState.state.collapsedProjectListParentKeys).toEqual(["PROJ-300"])
    expect(appState.state.collapsedTimelineParentKeys).toEqual([])

    await appState.browseRemoteProjects()
    appState.moveProjectPickerSelection(1)
    await appState.selectProjectPickerItem()
    await appState.selectProjectPickerItem()

    expect(appState.state.collapsedProjectListParentKeys).toEqual([])
  })

  test("refreshes project List from page one while retaining rows and staged overlays", async () => {
    const refresh = deferred<Awaited<ReturnType<WorkspaceSource["loadIssuePage"]>>>()
    const selected = loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!
    const removed = loadDevWorkspaceFixture("PROJ").issues["PROJ-128"]!
    let calls = 0
    const appState = createTestAppState({
      async loadIssuePage(sourceId) {
        calls += 1
        if (calls === 1) return { sourceId, issues: [selected, removed], pageState: { sourceId, startAt: 2, cursor: "old", maxResults: 50, total: 3, isLast: false, loading: false } }
        return refresh.promise
      },
    })

    appState.setRoute("list")
    await flushPromises()
    appState.setProjectListSelection(selected.key)
    appState.startInspectorEdit()
    appState.updateInspectorEditValue("Locally staged title")
    appState.commitInspectorEdit()
    const promise = appState.loadIssuePage(projectListIssuePageSourceId, true)

    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toEqual([selected.key, removed.key])
    expect(appState.state.issuePageStateBySource[projectListIssuePageSourceId]?.refreshing).toBe(true)
    refresh.resolve({ sourceId: projectListIssuePageSourceId, issues: [{ ...selected, title: "Fresh Jira title" }], pageState: { sourceId: projectListIssuePageSourceId, startAt: 1, cursor: "new", maxResults: 50, total: 3, isLast: false, loading: false }, sort: "updated" })
    await promise

    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toEqual([selected.key])
    expect(appState.state.projectListSelectedIssueKey).toBe(selected.key)
    expect(appState.state.issueDrafts[selected.key]?.title).toBe("Locally staged title")
    expect(appState.state.projectListSort).toBe("updated")
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
    expect(Object.values(appState.state.issueKeysBySource).flat()).not.toContain("DRAFT-1")
    expect(appState.state.selectedIssueKey).not.toBe("DRAFT-1")
    expect(stagedChanges(appState.state).some((change) => change.id === "create:DRAFT-1")).toBe(false)
  })

  test("adds List drafts only to project-list membership without an implied sprint", async () => {
    const appState = createTestAppState()
    appState.setRoute("list")
    await flushPromises()
    const draft = { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!, key: "DRAFT-1", sprintId: undefined, isDraft: true }

    appState.createDraftIssue(draft)

    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toContain("DRAFT-1")
    expect(appState.state.issueKeysBySource[boardIssuePageSourceId]).not.toContain("DRAFT-1")
    expect(appState.state.issues["DRAFT-1"]?.sprintId).toBeUndefined()
    expect(appState.state.projectListSelectedIssueKey).toBe("DRAFT-1")
  })

  test("adds Timeline drafts to project-list membership and selects the created row", async () => {
    const appState = createTestAppState()
    appState.setRoute("timeline")
    await flushPromises()
    const draft = { ...loadDevWorkspaceFixture("PROJ").issues["PROJ-121"]!, key: "DRAFT-1", sprintId: undefined, isDraft: true }

    appState.createDraftIssue(draft)

    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toContain("DRAFT-1")
    expect(appState.state.timelineSelectedIssueKey).toBe("DRAFT-1")
    expect(appState.state.issues["DRAFT-1"]?.sprintId).toBeUndefined()
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

  test("keeps staged rank projection through w and restores source order on discard", () => {
    const appState = createTestAppState()
    appState.state.board = { ...appState.state.board, type: "scrum" }
    const beforeGroup = groupBacklogIssues(appState.state, "sprint").find((group) => group.issueKeys.length >= 2)!
    const groupId = beforeGroup.id
    const before = beforeGroup.issueKeys
    const issueKey = before[0]!
    const targetIssueKey = before[1]!

    appState.stageIssueRank(issueKey, targetIssueKey, "after")
    expect(groupBacklogIssues(appState.state, "sprint").find((group) => group.id === groupId)!.issueKeys.slice(0, 2)).toEqual([targetIssueKey, issueKey])

    appState.applyIssueChanges()
    expect(groupBacklogIssues(appState.state, "sprint").find((group) => group.id === groupId)!.issueKeys.slice(0, 2)).toEqual([targetIssueKey, issueKey])

    appState.openStagedDiscard()
    appState.confirmStagedDiscard()
    expect(groupBacklogIssues(appState.state, "sprint").find((group) => group.id === groupId)!.issueKeys.slice(0, 2)).toEqual(before.slice(0, 2))
  })

  test("tracks backlog collapse independently and resets it on workspace switch", async () => {
    const appState = createTestAppState()

    appState.toggleBacklogGroupCollapsed("backlog")
    appState.toggleBacklogGroupCollapsed("sprint-25")
    expect(appState.state.collapsedBacklogGroupIds).toEqual(["backlog", "sprint-25"])
    appState.toggleBacklogGroupCollapsed("backlog")
    expect(appState.state.collapsedBacklogGroupIds).toEqual(["sprint-25"])

    await appState.browseRemoteProjects()
    appState.moveProjectPickerSelection(1)
    await appState.selectProjectPickerItem()
    await appState.selectProjectPickerItem()
    expect(appState.state.collapsedBacklogGroupIds).toEqual([])
  })

  test("uses loaded sprint choices for the existing safe move draft", () => {
    const appState = createTestAppState()
    const sprintFieldIndex = issueFields.findIndex((field) => field.id === "sprintId")

    appState.moveInspectorSelection(sprintFieldIndex - appState.state.inspectorSelectedFieldIndex)
    appState.startInspectorEdit()
    expect(appState.state.inspectorEditingFieldId).toBe("sprintId")
    expect(appState.state.inspectorEditValue).toBe("sprint-24")

    appState.moveInspectorChoice(1)
    appState.commitInspectorEdit()
    expect(appState.state.issueDrafts["PROJ-128"]?.sprintId).toBe("sprint-25")
  })

  test("stages only a Priority returned by Jira for the selected issue", async () => {
    const requests: string[] = []
    const appState = createTestAppState({
      async loadIssueFieldOptions(fieldId, issueKey) {
        requests.push(`${fieldId}:${issueKey}`)
        return [
          { value: "High", label: "High", color: "#FF5630" },
          { value: "Medium", label: "Medium", color: "#FFAB00" },
        ]
      },
    })
    const priorityFieldIndex = issueFields.findIndex((field) => field.id === "priority")

    appState.moveInspectorSelection(priorityFieldIndex - appState.state.inspectorSelectedFieldIndex)
    appState.startInspectorEdit()
    expect(appState.state.inspectorFieldPicker?.loading).toBe(true)
    await flushPromises()
    appState.moveInspectorChoice(1)
    appState.commitInspectorEdit()

    expect(requests).toEqual(["priority:PROJ-128"])
    expect(appState.state.issueDrafts["PROJ-128"]?.priority).toBe("Medium")
    expect(appState.state.inspectorFieldPicker).toBeUndefined()
  })

  test("keeps Priority editing open when Jira choices fail to load", async () => {
    const appState = createTestAppState({
      async loadIssueFieldOptions() {
        throw new Error("Priority choices are unavailable")
      },
    })
    const priorityFieldIndex = issueFields.findIndex((field) => field.id === "priority")

    appState.moveInspectorSelection(priorityFieldIndex - appState.state.inspectorSelectedFieldIndex)
    appState.startInspectorEdit()
    await flushPromises()
    appState.commitInspectorEdit()

    expect(appState.state.inspectorEditingFieldId).toBe("priority")
    expect(appState.state.inspectorFieldPicker?.error).toBe("Priority choices are unavailable")
    expect(appState.state.issueDrafts["PROJ-128"]?.priority).toBeUndefined()
  })

  test("ignores a stale Priority response after editing is cancelled", async () => {
    const response = deferred<Array<{ value: string; label: string }>>()
    const appState = createTestAppState({
      async loadIssueFieldOptions() {
        return response.promise
      },
    })
    const priorityFieldIndex = issueFields.findIndex((field) => field.id === "priority")

    appState.moveInspectorSelection(priorityFieldIndex - appState.state.inspectorSelectedFieldIndex)
    appState.startInspectorEdit()
    appState.cancelInspectorEdit()
    response.resolve([{ value: "High", label: "High" }])
    await flushPromises()

    expect(appState.state.inspectorEditingFieldId).toBeUndefined()
    expect(appState.state.inspectorFieldPicker).toBeUndefined()
  })

  test("filters Jira label suggestions while preserving custom label entry", async () => {
    const appState = createTestAppState({
      async loadIssueFieldOptions(fieldId) {
        if (fieldId === "labels") return ["auth", "release-blocker", "regression"].map((label) => ({ value: label, label }))
        return []
      },
    })
    const labelsFieldIndex = issueFields.findIndex((field) => field.id === "labels")
    appState.moveInspectorSelection(labelsFieldIndex - appState.state.inspectorSelectedFieldIndex)
    appState.startInspectorEdit()
    await flushPromises()

    appState.updateInspectorEditValue("auth, rel")
    expect(appState.state.inspectorFieldPicker?.options.map((option) => option.value)).toEqual(["release-blocker"])
    appState.moveInspectorChoice(1)
    expect(appState.state.inspectorEditValue).toBe("auth, release-blocker")
    appState.updateInspectorEditValue("auth, custom-label")
    appState.commitInspectorEdit()

    expect(appState.state.issueDrafts["PROJ-128"]?.labels).toBe("auth, custom-label")
  })

  test("posts successful comments and keeps failed comments staged", async () => {
    const posted: string[] = []
    const appState = createTestAppState({
      async postIssueComment(issueKey, body) {
        posted.push(`${issueKey}:${body}`)
        if (body === "Second comment") throw new Error("Jira 403: Comment permission denied")
      },
    })

    appState.startInspectorEdit()
    appState.updateInspectorEditValue("Field update stays staged")
    appState.commitInspectorEdit()
    appState.startComment()
    appState.updateCommentValue("First comment")
    appState.commitComment()
    appState.startComment()
    appState.updateCommentValue("Second comment")
    appState.commitComment()
    await appState.confirmRemoteIssueApply()

    expect(posted).toEqual(["PROJ-128:First comment", "PROJ-128:Second comment"])
    expect(appState.state.commentDrafts).toEqual([{ id: "comment-2", issueKey: "PROJ-128", body: "Second comment" }])
    expect(appState.state.issueDrafts["PROJ-128"]?.title).toBe("Field update stays staged")
  })

  test("applies mapped field edits and rank operations independently", async () => {
    const updates: Array<{ issueKey: string; fields: Record<string, unknown> }> = []
    const ranks: string[] = []
    const appState = createTestAppState({
      async updateIssue(issueKey, fields) {
        updates.push({ issueKey, fields })
      },
      async rankIssue(issueKey, targetIssueKey, position) {
        ranks.push(`${issueKey}:${position}:${targetIssueKey}`)
      },
    })

    appState.startInspectorEdit()
    appState.updateInspectorEditValue("Remote summary")
    appState.commitInspectorEdit()
    appState.stageIssueRank("PROJ-128", "PROJ-121", "after")
    await appState.confirmRemoteIssueApply()

    expect(updates).toEqual([{ issueKey: "PROJ-128", fields: { summary: "Remote summary" } }])
    expect(ranks).toEqual(["PROJ-128:after:PROJ-121"])
    expect(appState.state.issueDrafts["PROJ-128"]).toBeUndefined()
    expect(appState.state.rankDrafts["PROJ-128"]).toBeUndefined()
  })

  test("materializes successful remote rank order before clearing its projection", async () => {
    const appState = createTestAppState({ async rankIssue() {} })
    appState.state.board = { ...appState.state.board, type: "scrum" }
    const [sourceId, issueKeys] = Object.entries(appState.state.issueKeysBySource).find(([, keys]) => keys.length >= 2)!
    const issueKey = issueKeys[0]!
    const targetIssueKey = issueKeys[1]!

    appState.stageIssueRank(issueKey, targetIssueKey, "after")
    await appState.confirmRemoteIssueApply()

    expect(appState.state.issueKeysBySource[sourceId]!.slice(0, 2)).toEqual([targetIssueKey, issueKey])
    expect(appState.state.rankDrafts[issueKey]).toBeUndefined()
  })

  test("retains a failed remote rank projection for retry", async () => {
    const appState = createTestAppState({ async rankIssue() { throw new Error("rank failed") } })
    appState.state.board = { ...appState.state.board, type: "scrum" }
    const beforeGroup = groupBacklogIssues(appState.state, "sprint").find((group) => group.issueKeys.length >= 2)!
    const issueKey = beforeGroup.issueKeys[0]!
    const targetIssueKey = beforeGroup.issueKeys[1]!

    appState.stageIssueRank(issueKey, targetIssueKey, "after")
    await appState.confirmRemoteIssueApply()

    expect(appState.state.rankDrafts[issueKey]).toEqual({ issueKey, targetIssueKey, position: "after" })
    expect(groupBacklogIssues(appState.state, "sprint").find((group) => group.id === beforeGroup.id)!.issueKeys.slice(0, 2)).toEqual([targetIssueKey, issueKey])
  })

  test("requires a second remote confirmation before deleting an issue", async () => {
    const deleted: string[] = []
    const appState = createTestAppState({
      async deleteIssue(issueKey) {
        deleted.push(issueKey)
      },
    })

    appState.requestIssueDelete()
    appState.confirmIssueDelete()
    appState.openRemoteIssueApply()
    await appState.confirmRemoteIssueApply()
    expect(deleted).toEqual([])
    expect(appState.state.remoteDeleteConfirmationArmed).toBe(true)

    await appState.confirmRemoteIssueApply()
    expect(deleted).toEqual(["PROJ-128"])
    expect(appState.state.issues["PROJ-128"]).toBeUndefined()
  })

  test("stages a reporter selected from assignable Jira users with its account ID", async () => {
    const appState = createTestAppState({
      async loadUserPicker() {
        return [{ accountId: "reporter-account", displayName: "Project reporter" }]
      },
    })

    appState.moveInspectorSelection(5)
    appState.startInspectorEdit()
    await flushPromises()
    appState.commitInspectorEdit()

    expect(appState.state.issueDrafts["PROJ-128"]?.reporter).toBe("Project reporter")
    expect(appState.state.userDraftAccountIds["PROJ-128"]?.reporter).toBe("reporter-account")
  })

  test("debounces reporter lookups like assignee lookups", async () => {
    const queries: string[] = []
    const appState = createTestAppState({
      async loadUserPicker(fieldId, issueKey, projectKey, query) {
        queries.push(query)
        return [
          { accountId: "reporter-1", displayName: "Duy" },
          { accountId: "reporter-2", displayName: "Mina" },
        ]
      },
    })

    appState.moveInspectorSelection(5)
    appState.startInspectorEdit()
    await flushPromises()
    appState.updateInspectorEditValue("M")
    appState.updateInspectorEditValue("Mina")

    await Bun.sleep(300)
    expect(queries).toEqual(["", "Mina"])
    expect(appState.state.inspectorUserPicker?.options).toEqual([{ accountId: "reporter-2", displayName: "Mina" }])
  })

  test("clears picker state when cancelling a user edit", async () => {
    const appState = createTestAppState()

    appState.moveInspectorSelection(4)
    appState.startInspectorEdit()
    appState.cancelInspectorEdit()

    expect(appState.state.inspectorEditingFieldId).toBeUndefined()
    expect(appState.state.inspectorUserPicker).toBeUndefined()
  })

  test("debounces assignable-user lookups and moves the picker selection", async () => {
    const queries: string[] = []
    const appState = createTestAppState({
      async loadUserPicker(fieldId, issueKey, projectKey, query) {
        queries.push(query)
        return [
          { accountId: "assignee-1", displayName: "Duy" },
          { accountId: "assignee-2", displayName: "Mina" },
        ]
      },
    })

    appState.moveInspectorSelection(4)
    appState.startInspectorEdit()
    await flushPromises()
    appState.updateInspectorEditValue("D")
    appState.updateInspectorEditValue("Du")
    appState.updateInspectorEditValue("Duy")
    await Bun.sleep(300)
    appState.moveInspectorChoice(1)

    expect(queries).toEqual(["", "Duy"])
    expect(appState.state.inspectorUserPicker?.selectedIndex).toBe(0)
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

    appState.focusWorkspaceResults()
    appState.moveWorkspaceSelection(1)
    expect(appState.state.workspaceResultSelectedIndex).toBe(1)
    appState.openWorkspaceSelection()
    await flushPromises()
    expect(searchCalls).toBe(2)
    expect(appState.state.remoteSearchIssueKeys).toEqual(["PROJ-121", "PROJ-998"])
    expect(appState.state.workspaceFocusedArea).toBe("results")
    expect(appState.state.workspaceResultSelectedIndex).toBe(1)
  })
})

function createTestAppState(overrides: Partial<WorkspaceSource> = {}, saveWorkspaceConfig: (workspace: JiraWorkspaceConfig) => Promise<unknown> = async () => undefined, initialWorkspaceSelection?: WorkspaceSelection, initialWorkspaceReady = false, initialRoute?: "list" | "timeline") {
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
      async fetchProjectPage({ query, startAt, maxResults }) {
        return projectPage(query, startAt, maxResults)
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
      async postIssueComment() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async updateIssue() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async transitionIssue() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async moveIssueToSprint() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async updateDiscoveredField() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async updateIssueType() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async deleteIssue() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async createIssue() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async createIssueLinks() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async rankIssue() {
        throw new Error("Remote Jira writes are unavailable in dev runtime")
      },
      async loadIssueFieldOptions(fieldId, issueKey) {
        const issue = loadDevWorkspaceFixture("PROJ").issues[issueKey]
        if (!issue) return []
        return fieldId === "priority"
          ? [{ value: issue.priority, label: issue.priority, color: issue.priorityColor }]
          : issue.labels.map((label) => ({ value: label, label }))
      },
      async loadUserPicker(fieldId, issueKey, projectKey, query) {
        return [{ accountId: "duy-account", displayName: "Duy" }].filter((user) => !query || user.displayName.toLowerCase().includes(query.toLowerCase()))
      },
      ...overrides,
    }
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.jiraProjectReady = initialWorkspaceReady
    if (initialRoute) initialState.route = initialRoute
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
  if (sourceId === projectListIssuePageSourceId) return true
  if (sourceId === boardIssuePageSourceId) return !!sprintId
  if (sourceId === backlogIssuePageSourceId) return !sprintId
  if (sourceId.startsWith("sprint:")) return sourceId === sprintIssuePageSourceId(sprintId ?? "")
  return false
}

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function projectPage(query: string, startAt: number, maxResults: number) {
  const normalized = query.trim().toLowerCase()
  const matches = devProjects.filter((project) => !normalized || `${project.key} ${project.name}`.toLowerCase().includes(normalized))
  const items = matches.slice(startAt, startAt + maxResults)
  return { items, startAt, maxResults, total: matches.length, isLast: startAt + items.length >= matches.length }
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
