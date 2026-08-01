import { afterEach, describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { App } from "./app"
import { useAppState, type AppStateContext } from "./context/app-state"
import { LazyJiraKeymapProvider } from "./context/keymap"
import { AppProviders } from "./context/providers"
import { selectIcons, type IconMode } from "./icons/catalog"
import { BacklogRoute } from "./routes/backlog"
import { ProjectListRoute } from "./routes/project-list"
import { TimelineRoute } from "./routes/timeline"
import { createInitialAppState } from "./state/initial"
import { projectListIssuePageSourceId } from "./state/issue-pages"
import { halfViewportRows } from "./state/keyboard-context"
import { projectListRows, projectListSelection } from "./state/project-list"
import { groupBacklogIssues } from "./state/selectors"
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

function disposeRenderer(renderer: Awaited<ReturnType<typeof createTestRenderer>>["renderer"]) {
  if (!renderer.isDestroyed) renderer.destroy()
  const index = renderers.indexOf(renderer)
  if (index >= 0) renderers.splice(index, 1)
}
