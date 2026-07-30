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

const disposers: Array<() => void> = []

afterEach(() => {
  while (disposers.length) disposers.pop()?.()
})

describe("app state project picker", () => {
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
    await appState.loadIssuePage(projectListIssuePageSourceId)

    expect(calls).toBe(2)
    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toEqual(["PROJ-121", "PROJ-128"])
    expect(appState.state.issueKeysBySource[boardIssuePageSourceId]).toEqual(boardKeys)
    expect(appState.state.projectListSelectedIssueKey).toBe("PROJ-121")
    expect(appState.state.selectedIssueKey).toBe("PROJ-121")
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
    appState.setProjectListSelection(issue.key)
    appState.openSearch()
    appState.updateSearchDraft("oauth")
    appState.commitSearch()
    await appState.loadIssuePage(projectListIssuePageSourceId)

    expect(appState.state.issueKeysBySource[projectListIssuePageSourceId]).toEqual([issue.key])
    expect(appState.state.projectListSelectedIssueKey).toBe(issue.key)
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
    expect(appState.state.timelineStartDateField).toMatchObject({ status: "unavailable", reason: "ambiguous" })
    expect(appState.state.timelineParentHydrationError).toBe("Parent hydration failed: Jira 403")
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

  test("stages comments and backlog rank operations", () => {
    const appState = createTestAppState()

    appState.startComment()
    appState.updateCommentValue("Ready for review")
    appState.commitComment()
    appState.stageIssueRank("PROJ-128", "PROJ-121", "after")

    expect(appState.state.commentDrafts).toEqual([{ id: "comment-1", issueKey: "PROJ-128", body: "Ready for review" }])
    expect(appState.state.rankDrafts["PROJ-128"]).toEqual({ issueKey: "PROJ-128", targetIssueKey: "PROJ-121", position: "after" })
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

function createTestAppState(overrides: Partial<WorkspaceSource> = {}, saveWorkspaceConfig: (workspace: JiraWorkspaceConfig) => Promise<unknown> = async () => undefined, initialWorkspaceSelection?: WorkspaceSelection, initialWorkspaceReady = false, initialRoute?: "list") {
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}
