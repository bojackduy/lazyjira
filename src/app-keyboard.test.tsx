import { afterEach, describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { App } from "./app"
import { useAppState, type AppStateContext } from "./context/app-state"
import { LazyJiraKeymapProvider } from "./context/keymap"
import { AppProviders } from "./context/providers"
import { useIcons, type IconContext } from "./context/icons"
import { selectIcons, type IconMode } from "./icons/catalog"
import { BacklogRoute } from "./routes/backlog"
import { ProjectListRoute } from "./routes/project-list"
import { TimelineRoute } from "./routes/timeline"
import { createInitialAppState } from "./state/initial"
import { backlogIssuePageSourceId, boardIssuePageSourceId, projectListIssuePageSourceId, sprintIssuePageSourceId } from "./state/issue-pages"
import { halfViewportRows } from "./state/keyboard-context"
import { issueFields } from "./state/issue-fields"
import { projectListLoadMoreRowKey, projectListRows, projectListSelection } from "./state/project-list"
import { groupBacklogIssues } from "./state/selectors"
import { boardCellIssueKeys } from "./state/board-navigation"
import { projectTimelineViewRows, timelineCreateRowKey, timelineModel, timelineSelection, timelineUnparentedExpandedKey, timelineUnparentedSectionKey } from "./state/timeline"
import type { AppState } from "./state/app-state"
import { loadDevWorkspaceFixture } from "./workspace/dev/fixtures"
import { createDevWorkspaceSource } from "./workspace/dev/source"

const renderers: Array<Awaited<ReturnType<typeof createTestRenderer>>["renderer"]> = []
const originalIconMode = process.env.LAZYJIRA_ICON_MODE

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()
    if (renderer && !renderer.isDestroyed) renderer.destroy()
  }
  if (originalIconMode === undefined) delete process.env.LAZYJIRA_ICON_MODE
  else process.env.LAZYJIRA_ICON_MODE = originalIconMode
})

describe("keyboard input ownership", () => {
  test("keeps Active sprint j/k selection visible before any manual paging", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.route = "board"
    initialState.focusedPane = "main"
    initialState.board = { ...initialState.board, type: "scrum" }
    const baseIssue = initialState.issues["PROJ-121"]!
    const issueKeys = Array.from({ length: 15 }, (_, index) => `SCROLL-${String(index + 1).padStart(2, "0")}`)
    for (const [index, key] of issueKeys.entries()) {
      initialState.issues[key] = { ...baseIssue, key, title: `Scrollable sprint card ${index + 1}`, assignee: index < 11 ? "Alice" : index < 13 ? "Bao" : "Dung", sprintId: initialState.activeSprintId }
    }
    initialState.issueKeysBySource[sprintIssuePageSourceId(initialState.activeSprintId)] = issueKeys
    initialState.selectedIssueKey = issueKeys[0]!
    initialState.selectedBoardLocations["active-sprint"] = {
      groupIndex: 0,
      statusIndex: initialState.statuses.findIndex((status) => status.id === baseIssue.statusId),
      itemIndex: 0,
    }
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const width = 120
    const setup = await createTestRenderer({ width, height: 24 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    setup.mockInput.pressKey("g")
    await setup.flush()
    setup.mockInput.pressKey("g")
    await setup.flush()
    expect(appState!.state.activeSprintGroupBy).toBe("assignee")

    for (let index = 1; index < 10; index += 1) {
      setup.mockInput.pressKey("j")
      await setup.flush()
      await Bun.sleep(20)
      await setup.flush()
      const selectedKey = issueKeys[index]!
      const cardVisible = setup.captureCharFrame().split("\n").some((line) => {
        const column = line.indexOf(selectedKey)
        return column >= 28 && column < width - 40
      })
      expect(appState!.state.selectedIssueKey).toBe(selectedKey)
      expect(cardVisible, `${selectedKey} should remain visible in the board pane`).toBe(true)
    }
  })

  test("keeps List j/k selection visible before any manual paging", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.route = "list"
    initialState.focusedPane = "main"
    initialState.issueTypes = [{ id: "Initiative", name: "Initiative", color: "#22C55E", hierarchyLevel: 2 }]
    const baseIssue = initialState.issues["PROJ-101"]!
    const issueKeys = Array.from({ length: 20 }, (_, index) => `LIST-${String(index + 1).padStart(2, "0")}`)
    initialState.issues = Object.fromEntries(issueKeys.map((key, index) => [key, { ...baseIssue, key, title: `Scrollable list row ${index + 1}`, type: "Initiative", typeName: "Initiative", typeHierarchyLevel: 2, parentKey: undefined, parent: undefined }]))
    initialState.issueKeysBySource[projectListIssuePageSourceId] = issueKeys
    initialState.projectListSelectedIssueKey = issueKeys[0]
    initialState.selectedIssueKey = issueKeys[0]!
    initialState.collapsedProjectListParentKeys = []
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const setup = await createTestRenderer({ width: 120, height: 18 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    for (let index = 1; index < 15; index += 1) setup.mockInput.pressKey("j")
    await setup.flush()
    await Bun.sleep(20)
    await setup.flush()

    const selectedKey = issueKeys[14]!
    expect(appState!.state.projectListSelectedIssueKey).toBe(selectedKey)
    expect(setup.captureCharFrame()).toContain(`>${selectedKey}`)

    setup.mockInput.pressKey("3")
    await setup.flush()
    setup.mockInput.pressKey("4")
    await setup.flush()
    await Bun.sleep(20)
    await setup.flush()

    expect(appState!.state.projectListSelectedIssueKey).toBe(selectedKey)
    expect(setup.captureCharFrame()).toContain(`>${selectedKey}`)
  })

  test("selects and opens the List load-more action without replacing issue selection", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.route = "list"
    initialState.focusedPane = "main"
    const first = { ...initialState.issues["PROJ-101"]!, type: "Initiative", typeName: "Initiative", typeHierarchyLevel: 2, parentKey: undefined, parent: undefined }
    const second = { ...first, key: "PROJ-NEW", title: "First issue on the next page" }
    initialState.issueTypes = [{ id: "Initiative", name: "Initiative", color: "#22C55E", hierarchyLevel: 2 }]
    initialState.issues = { [first.key]: first }
    initialState.issueKeysBySource[projectListIssuePageSourceId] = [first.key]
    initialState.issuePageStateBySource[projectListIssuePageSourceId] = { sourceId: projectListIssuePageSourceId, startAt: 1, maxResults: 50, total: 2, isLast: false, loading: false }
    initialState.projectListSelectedIssueKey = first.key
    initialState.selectedIssueKey = first.key
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const source = {
      ...createDevWorkspaceSource(),
      async loadIssuePage(sourceId: string) {
        return { sourceId, issues: [second], pageState: { sourceId, startAt: 2, maxResults: 50, total: 2, isLast: true, loading: false } }
      },
    }
    const setup = await createTestRenderer({ width: 120, height: 20 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders config={{ appName: "lazyjira", runtimeEnv: "dev" }} initialState={initialState} source={source} saveWorkspaceConfig={async () => undefined} iconMode="ascii" onExit={() => undefined}>
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    expect(setup.captureCharFrame()).toContain("! PARTIAL RESULTS")
    setup.mockInput.pressKey("j")
    await setup.flush()
    expect(appState!.state.projectListSelectedIssueKey).toBe(projectListLoadMoreRowKey)
    expect(appState!.state.selectedIssueKey).toBe(first.key)

    setup.mockInput.pressEnter()
    await Bun.sleep(20)
    await setup.flush()
    expect(appState!.state.projectListSelectedIssueKey).toBe(second.key)
    expect(appState!.state.selectedIssueKey).toBe(second.key)
    expect(setup.captureCharFrame()).not.toContain("! PARTIAL RESULTS")
  })

  test("selects a source-specific Backlog load-more action and focuses the appended issue", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.route = "backlog"
    initialState.focusedPane = "main"
    initialState.board = { ...initialState.board, type: "scrum" }
    initialState.backlogGroupBy = "sprint"
    const group = groupBacklogIssues(initialState, "sprint").find((candidate) => candidate.id === "backlog")!
    const previous = initialState.issues[group.issueKeys.at(-1)!]!
    const appended = { ...previous, key: "PROJ-BACKLOG-NEXT", title: "Next backlog page issue", sprintId: undefined }
    initialState.selectedBacklogGroupId = group.id
    initialState.selectedIssueKey = previous.key
    initialState.issuePageStateBySource[backlogIssuePageSourceId] = { sourceId: backlogIssuePageSourceId, startAt: group.issueKeys.length, maxResults: 100, total: group.issueKeys.length + 1, isLast: false, loading: false }
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }
    let loadCalls = 0
    const source = {
      ...createDevWorkspaceSource(),
      async loadIssuePage(sourceId: string) {
        loadCalls += 1
        return { sourceId, issues: [appended], pageState: { sourceId, startAt: group.issueKeys.length + 1, maxResults: 100, total: group.issueKeys.length + 1, isLast: true, loading: false } }
      },
    }
    const setup = await createTestRenderer({ width: 150, height: 28 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders config={{ appName: "lazyjira", runtimeEnv: "dev" }} initialState={initialState} source={source} saveWorkspaceConfig={async () => undefined} iconMode="ascii" onExit={() => undefined}>
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    setup.mockInput.pressKey("j")
    await setup.flush()
    expect(appState!.state.selectedLoadMoreSourceId).toBe(backlogIssuePageSourceId)
    expect(appState!.state.selectedIssueKey).toBe(previous.key)

    setup.mockInput.pressEnter()
    await Bun.sleep(20)
    await setup.flush()
    expect(loadCalls).toBe(1)
    expect(appState!.state.selectedLoadMoreSourceId).toBeUndefined()
    expect(appState!.state.selectedIssueKey).toBe(appended.key)
  })

  test("moves from the Kanban grid to its full-width load-more action", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.route = "board"
    initialState.focusedPane = "main"
    initialState.board = { ...initialState.board, type: "kanban" }
    initialState.kanbanGroupBy = "none"
    const statusIndex = 0
    const itemIndex = boardCellIssueKeys(initialState, "kanban", 0, statusIndex).length
    initialState.selectedBoardLocations.kanban = { groupIndex: 0, statusIndex, itemIndex }
    initialState.issuePageStateBySource[boardIssuePageSourceId] = { sourceId: boardIssuePageSourceId, startAt: 1, maxResults: 100, total: 2, isLast: false, loading: false }
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const setup = await createTestRenderer({ width: 150, height: 28 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders config={{ appName: "lazyjira", runtimeEnv: "dev" }} initialState={initialState} source={createDevWorkspaceSource()} saveWorkspaceConfig={async () => undefined} iconMode="ascii" onExit={() => undefined}>
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    setup.mockInput.pressKey("j")
    await setup.flush()
    await Bun.sleep(20)
    await setup.flush()
    expect(appState!.state.selectedLoadMoreSourceId).toBe(boardIssuePageSourceId)
    expect(setup.captureCharFrame()).toContain("[L] LOAD NEXT 1")
    setup.mockInput.pressKey("k")
    await setup.flush()
    expect(appState!.state.selectedLoadMoreSourceId).toBeUndefined()
  })

  test("centers the selected Backlog issue after h/l group jumps", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.route = "backlog"
    initialState.focusedPane = "main"
    initialState.backlogGroupBy = "issueType"
    const groups = groupBacklogIssues(initialState, initialState.backlogGroupBy)
    const targetGroupIndex = Math.min(2, groups.length - 1)
    initialState.selectedBacklogGroupId = groups[0]!.id
    initialState.selectedIssueKey = groups[0]!.issueKeys[0]!
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const height = 30
    const setup = await createTestRenderer({ width: 180, height })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    for (let index = 0; index < targetGroupIndex; index += 1) {
      setup.mockInput.pressKey("l")
      await setup.flush()
    }

    const selectedKey = appState!.state.selectedIssueKey
    const selectedRows = setup.captureCharFrame().split("\n")
      .flatMap((line, index) => line.includes(selectedKey) ? [index] : [])
    const centerDistance = Math.min(...selectedRows.map((index) => Math.abs(index - Math.floor(height / 2))))

    expect(appState!.state.selectedBacklogGroupId).toBe(groups[targetGroupIndex]!.id)
    expect(centerDistance).toBeLessThanOrEqual(4)
  })

  test("projects repeated Backlog rank keys against the currently visible order", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.route = "backlog"
    initialState.focusedPane = "main"
    initialState.board = { ...initialState.board, type: "scrum" }
    initialState.backlogGroupBy = "sprint"
    const group = groupBacklogIssues(initialState, "sprint").find((candidate) => candidate.issueKeys.length >= 3)!
    const original = [...group.issueKeys]
    initialState.selectedBacklogGroupId = group.id
    initialState.selectedIssueKey = original[0]!
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const setup = await createTestRenderer({ width: 180, height: 30 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    setup.mockInput.pressKey("j", { shift: true })
    await setup.flush()
    setup.mockInput.pressKey("j", { shift: true })
    await setup.flush()

    const projected = groupBacklogIssues(appState!.state, "sprint").find((candidate) => candidate.id === group.id)!.issueKeys
    const first = original[0]!
    const second = original[1]!
    const third = original[2]!
    expect(projected.slice(0, 3)).toEqual([second, third, first])
    expect(appState!.state.rankDrafts[first]).toEqual({ issueKey: first, targetIssueKey: third, position: "after" })
  })

  test("keeps long Inspector type choices visible while navigating", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.issueTypes = [
      { id: "10024", name: "Bug", color: "#ff0000" },
      { id: "10000", name: "Feature", color: "#ff0000", hierarchyLevel: 1 },
      { id: "10092", name: "Improvement", color: "#ff0000" },
      { id: "10005", name: "Precondition", color: "#ff0000" },
      { id: "11199", name: "Risk", color: "#ff0000" },
      { id: "10096", name: "Spike", color: "#ff0000" },
      { id: "10009", name: "Story", color: "#ff0000" },
      { id: "10022", name: "Task", color: "#ff0000" },
      { id: "10084", name: "Technical Debt", color: "#ff0000" },
      { id: "10001", name: "Test", color: "#ff0000" },
      { id: "10002", name: "Test Set", color: "#ff0000" },
      { id: "10004", name: "Test Execution", color: "#ff0000" },
      { id: "10003", name: "Test Plan", color: "#ff0000" },
      { id: "10023", name: "Sub-task", color: "#ff0000", subtask: true },
      { id: "10075", name: "Story Defect", color: "#ff0000", subtask: true },
      { id: "10030", name: "Sub Test Execution", color: "#ff0000", subtask: true },
    ]
    initialState.focusedPane = "inspector"
    initialState.inspectorSelectedFieldIndex = issueFields.findIndex((field) => field.id === "type")
    const setup = await createTestRenderer({ width: 120, height: 20 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    setup.mockInput.pressKey("e")
    await setup.flush()
    for (let index = 0; index < 15; index += 1) setup.mockInput.pressKey("j")
    await setup.flush()

    expect(setup.captureCharFrame()).toContain("> s Sub Test Execution")
  })

  test("navigates and stages Jira Priority choices instead of editing free text", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.focusedPane = "inspector"
    initialState.inspectorSelectedFieldIndex = issueFields.findIndex((field) => field.id === "priority")
    const setup = await createTestRenderer({ width: 120, height: 24 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()
    const issueKey = appState!.state.selectedIssueKey

    setup.mockInput.pressKey("e")
    await setup.flush()
    expect(appState!.state.inspectorEditValue).toBe("Critical")
    expect(appState!.state.inspectorFieldPicker?.options.map((option) => option.value)).toEqual(["Critical", "Medium", "High", "Low"])
    expect(appState!.state.inspectorFieldPicker?.selectedIndex).toBe(0)

    setup.mockInput.pressKey("j")
    await setup.flush()
    expect(appState!.state.inspectorEditValue).toBe("Medium")
    appState!.commitInspectorEdit()
    await setup.flush()

    expect(appState!.state.issueDrafts[issueKey]?.priority).toBe("Medium")
    expect(appState!.state.inspectorEditingFieldId).toBeUndefined()
  })

  test("opens icon mode selection from the command palette and applies it live", async () => {
    process.env.LAZYJIRA_ICON_MODE = "unicode"
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    const persisted: IconMode[] = []
    let appState: AppStateContext | undefined
    let icons: IconContext | undefined
    const Capture = () => {
      appState = useAppState()
      icons = useIcons()
      return null
    }
    const setup = await createTestRenderer({ width: 120, height: 36 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          saveIconMode={async (mode) => { persisted.push(mode) }}
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    setup.mockInput.pressKey(";")
    await setup.flush()
    expect(appState!.state.commandPaletteOpen).toBe(true)
    await setup.mockInput.typeText("change icon")
    setup.mockInput.pressEnter()
    await setup.flush()
    expect(appState!.state.iconModePickerOpen).toBe(true)
    expect(setup.captureCharFrame()).toContain("Change Icon Mode")

    setup.mockInput.pressKey("k")
    setup.mockInput.pressEnter()
    await setup.flush()
    expect(appState!.state.iconModePickerOpen).toBe(false)
    expect(icons!.mode).toBe("nerd")
    expect(persisted).toEqual(["nerd"])
    expect(setup.captureCharFrame()).toContain("\uf015 Workspace")
  })

  test("onboarding accepts route shortcut letters and punctuation without moving Timeline", async () => {
    process.env.LAZYJIRA_ICON_MODE = "unicode"
    const workspace = loadDevWorkspaceFixture("PROJ")
    const initialState = createInitialAppState(structuredClone(workspace), "dev")
    const projectIssueKeys = Object.keys(initialState.issues)
    initialState.route = "timeline"
    initialState.focusedPane = "main"
    initialState.issueKeysBySource[projectListIssuePageSourceId] = projectIssueKeys
    initialState.issuePageStateBySource[projectListIssuePageSourceId] = {
      sourceId: projectListIssuePageSourceId,
      startAt: projectIssueKeys.length,
      maxResults: 50,
      total: projectIssueKeys.length,
      isLast: true,
      loading: false,
    }
    initialState.timelineSelectedIssueKey = projectIssueKeys[0]
    initialState.authOnboarding.open = true
    let appState: AppStateContext | undefined
    let exitCount = 0
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const setup = await createTestRenderer({ width: 120, height: 36 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          onExit={() => { exitCount += 1 }}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()
    const selectedBeforeTyping = appState!.state.timelineSelectedIssueKey

    await setup.mockInput.typeText("https://dujkh-l.example")
    setup.mockInput.pressEnter()
    await setup.flush()
    await setup.mockInput.typeText("dujkh+l@example.com")
    setup.mockInput.pressEnter()
    await setup.flush()
    await setup.mockInput.typeText("dujkh-l_[];:/?")
    await setup.flush()

    expect(appState!.state.authOnboarding).toMatchObject({
      step: "apiToken",
      baseUrl: "https://dujkh-l.example",
      email: "dujkh+l@example.com",
      apiToken: "dujkh-l_[];:/?",
    })
    expect(appState!.state.timelineSelectedIssueKey).toBe(selectedBeforeTyping)
    expect(exitCount).toBe(0)
  })

  test("plain and Ctrl paging keep narrow Timeline and wide List destinations visible", async () => {
    process.env.LAZYJIRA_ICON_MODE = "unicode"
    const structural = selectIcons("unicode").catalog.structural
    const timelineHeight = 24
    const timeline = await renderRoute("timeline", 80, timelineHeight)

    timeline.setup.mockInput.pressKey("d")
    await timeline.setup.flush()
    expect(timeline.appState.state.timelineSelectedIssueKey).toBe(timelineCreateRowKey)
    expect(timeline.setup.captureCharFrame()).toContain(`${structural.selection} ${structural.create} New`)

    const timelineRows = projectTimelineViewRows(timelineModel(timeline.appState.state).rows, timeline.appState.state.collapsedTimelineParentKeys)
    const timelineExpected = timelineSelection(timelineRows, timelineCreateRowKey, -halfViewportRows(timelineHeight - 14))
    timeline.setup.mockInput.pressKey("u", { ctrl: true })
    await timeline.setup.flush()
    expect(timeline.appState.state.timelineSelectedIssueKey).toBe(timelineExpected)
    expect(timeline.setup.captureCharFrame()).toContain(timelineExpected!)

    const list = await renderRoute("list", 180, 30)
    const listKeys = projectListRows(list.appState.state).map((row) => row.issue.key)
    const first = list.appState.state.projectListSelectedIssueKey
    const expectedDown = projectListSelection(listKeys, first, halfViewportRows(30 - 13))

    list.setup.mockInput.pressKey("d")
    await list.setup.flush()
    expect(list.appState.state.projectListSelectedIssueKey).toBe(expectedDown)
    expect(list.setup.captureCharFrame()).toContain(`${structural.selection}${expectedDown}`)

    list.setup.mockInput.pressKey("u", { ctrl: true })
    await list.setup.flush()
    expect(list.appState.state.projectListSelectedIssueKey).toBe(first)
    expect(list.setup.captureCharFrame()).toContain(`${structural.selection}${first}`)
  })

  test("renders a bounded Timeline header with separated weekly cells", async () => {
    const timeline = await renderRoute("timeline", 180, 30, (state) => {
      state.timelineZoom = "week"
      state.timelineWindowStart = "2026-06-15"
    })
    const frame = timeline.setup.captureCharFrame()

    expect(frame).toMatch(/06\/15\s+06\/22\s+06\/29/)
    expect(frame).not.toContain("06/1506/22")
  })

  test("keeps the visible center date anchored while zooming Timeline", async () => {
    const timeline = await renderRoute("timeline", 200, 30, (state) => {
      state.timelineZoom = "month"
      state.timelineWindowStart = "2026-01-01"
    })

    timeline.setup.mockInput.pressKey("z")
    await timeline.setup.flush()

    expect(timeline.appState.state.timelineZoom).toBe("day")
    expect(timeline.appState.state.timelineWindowStart).toBe("2026-06-11")
  })

  test("renders structural states without column drift in every icon profile", async () => {
    for (const mode of ["nerd", "unicode", "ascii"] satisfies IconMode[]) {
      process.env.LAZYJIRA_ICON_MODE = mode
      const structural = selectIcons(mode).catalog.structural

      for (const width of [60, 180]) {
        const timeline = await renderRoute("timeline", width, 60, (state) => {
          state.collapsedTimelineParentKeys = [timelineUnparentedExpandedKey]
          state.timelineSelectedIssueKey = timelineUnparentedSectionKey
        })
        const timelineFrame = timeline.setup.captureCharFrame()
        expect(timelineFrame).toContain(`${structural.selection} ${structural.expanded} Unparented issues`)
        expect(timelineFrame).toContain(`${structural.missingParent} PROJ-305`)
        expect(timelineFrame).toContain(`${structural.invalidHierarchy} Invalid hierarchy`)
        expect(timelineFrame).toContain(`${structural.invalidHierarchy} PROJ-306`)
        expect(timelineFrame).toContain(`${structural.leaf} PROJ-303`)
        expect(timelineFrame).toContain(`  ${structural.create} New initiative`)
        disposeRenderer(timeline.setup.renderer)

        const list = await renderRoute("list", width, 60, (state) => {
          state.collapsedProjectListParentKeys = []
          state.projectListSelectedIssueKey = projectListRows(state)[0]?.issue.key
        })
        const firstListRow = projectListRows(list.appState.state)[0]!
        const listFrame = list.setup.captureCharFrame()
        expect(listFrame).toContain(`${structural.selection}${firstListRow.issue.key}`)
        expect(listFrame).toContain(`${structural.expanded} ${firstListRow.issue.title}`)
        expect(listFrame).toContain(`${structural.leaf} Cycle guard tests`)
        disposeRenderer(list.setup.renderer)

        const backlog = await renderRoute("backlog", width, 60, (state) => {
          const groups = groupBacklogIssues(state, state.backlogGroupBy)
          state.collapsedBacklogGroupIds = groups[0] ? [groups[0].id] : []
        })
        const backlogGroups = groupBacklogIssues(backlog.appState.state, backlog.appState.state.backlogGroupBy)
        const backlogFrame = backlog.setup.captureCharFrame()
        expect(backlogFrame).toContain(`${structural.collapsed} ${backlogGroups[0]!.label}`)
        disposeRenderer(backlog.setup.renderer)

        const expandedBacklog = await renderRoute("backlog", width, 60, (state) => {
          state.collapsedBacklogGroupIds = []
        })
        const expandedGroups = groupBacklogIssues(expandedBacklog.appState.state, expandedBacklog.appState.state.backlogGroupBy)
        expect(expandedBacklog.setup.captureCharFrame()).toContain(`${structural.expanded} ${expandedGroups[0]!.label}`)
        disposeRenderer(expandedBacklog.setup.renderer)
      }
    }
  })
})

async function renderRoute(route: "timeline" | "list" | "backlog", width: number, height: number, mutate?: (state: AppState) => void) {
  const workspace = loadDevWorkspaceFixture("PROJ")
  const initialState = createInitialAppState(structuredClone(workspace), "dev")
  const projectIssueKeys = Object.keys(initialState.issues)
  initialState.route = route
  initialState.focusedPane = "main"
  initialState.issueKeysBySource[projectListIssuePageSourceId] = projectIssueKeys
  initialState.issuePageStateBySource[projectListIssuePageSourceId] = {
    sourceId: projectListIssuePageSourceId,
    startAt: projectIssueKeys.length,
    maxResults: 50,
    total: projectIssueKeys.length,
    isLast: true,
    loading: false,
  }
  initialState.timelineSelectedIssueKey = timelineUnparentedSectionKey
  initialState.projectListSelectedIssueKey = projectListRows(initialState)[0]?.issue.key
  mutate?.(initialState)
  let appState: AppStateContext | undefined
  const Capture = () => {
    appState = useAppState()
    return null
  }
  const setup = await createTestRenderer({ width, height })
  renderers.push(setup.renderer)
  const keymap = createDefaultOpenTuiKeymap(setup.renderer)
  await render(() => (
    <LazyJiraKeymapProvider keymap={keymap}>
      <AppProviders
        config={{ appName: "lazyjira", runtimeEnv: "dev" }}
        initialState={initialState}
        source={createDevWorkspaceSource()}
        saveWorkspaceConfig={async () => undefined}
        onExit={() => undefined}
      >
        <Capture />
        {route === "timeline" ? <TimelineRoute /> : route === "list" ? <ProjectListRoute /> : <BacklogRoute />}
      </AppProviders>
    </LazyJiraKeymapProvider>
  ), setup.renderer)
  await setup.flush()
  if (!appState) throw new Error("App state was not initialized")
  return { appState, setup }
}

test("detail section focus navigates sections and items via state", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.route = "issue-detail"
    initialState.focusedPane = "main"
    initialState.previousRoute = "board"
    initialState.issueDetailLoadedAtByKey[initialState.selectedIssueKey] = new Date().toISOString()
    let appState: AppStateContext | undefined
    const Capture = () => {
      appState = useAppState()
      return null
    }
    const setup = await createTestRenderer({ width: 120, height: 26 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    appState!.setDetailSectionFocus(true)
    expect(appState!.state.detailSectionIndex).toBe(0)
    expect(appState!.state.detailSectionItemIndex).toBe(0)

    appState!.setDetailSectionIndex(1)
    expect(appState!.state.detailSectionIndex).toBe(1)
    expect(appState!.state.detailSectionItemIndex).toBe(0)

    appState!.moveDetailSectionItem(2, 13)
    expect(appState!.state.detailSectionItemIndex).toBe(2)
    appState!.moveDetailSectionItem(1, 13)
    expect(appState!.state.detailSectionItemIndex).toBe(3)

    appState!.setDetailSectionIndex(3)
    expect(appState!.state.detailSectionItemIndex).toBe(0)

    appState!.setDetailSectionFocus(false)
    expect(appState!.state.detailSectionFocus).toBe(false)
  })

function disposeRenderer(renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"]) {
  if (!renderer.isDestroyed) renderer.destroy()
  const index = renderers.indexOf(renderer)
  if (index >= 0) renderers.splice(index, 1)
}
