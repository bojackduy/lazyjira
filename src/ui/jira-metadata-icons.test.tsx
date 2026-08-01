import { afterEach, describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import type { JSX } from "solid-js"
import { LazyJiraKeymapProvider } from "../context/keymap"
import { AppProviders } from "../context/providers"
import { IssueDetailRoute } from "../routes/issue-detail"
import { WorkspaceRoute } from "../routes/workspace"
import { createInitialAppState } from "../state/initial"
import { workspaceItems } from "../state/workspace"
import { createDevWorkspaceSource } from "../workspace/dev/source"
import { loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import { BoardSurface } from "./board"
import { IssueInspector } from "./issue-inspector"

const renderers: Array<Awaited<ReturnType<typeof createTestRenderer>>["renderer"]> = []

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()
    if (renderer && !renderer.isDestroyed) renderer.destroy()
  }
})

describe("Jira metadata icons", () => {
  test("renders semantic issue-type and status icons on board cards and legends", async () => {
    const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    state.route = "board"
    const setup = await renderSurface(state, () => <BoardSurface mode="active-sprint" />, 180, 40)
    const frame = setup.captureCharFrame()

    expect(frame).toContain("! Bug")
    expect(frame).toContain("✓ Task")
    expect(frame).toContain("◉ In Progress")
    expect(frame).toContain("! Blocked")
    expect(frame).toContain("! PROJ-128")
  })

  test("renders semantic icons for workspace issue metadata and exceptional state", async () => {
    const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    state.route = "workspace"
    state.workspaceSelectedIndex = workspaceItems(state).findIndex((item) => item.id === "queue:unassigned")
    state.workspaceFocusedArea = "results"
    const setup = await renderSurface(state, () => <WorkspaceRoute />, 140, 42)
    const frame = setup.captureCharFrame()

    expect(frame).toContain("✓ PROJ-211")
    expect(frame).toContain("– Medium")
    expect(frame).toContain("? Unassigned")
    expect(frame).toContain("○ To Do")
    expect(frame).toContain("◷ stale 11d")
  })

  test("renders detail, inspector, and parent icons without changing a staged canonical type ID", async () => {
    const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    state.route = "issue-detail"
    state.selectedIssueKey = "PROJ-121"
    state.issues["PROJ-121"] = { ...state.issues["PROJ-121"]!, description: "Metadata icon detail" }
    state.issueDrafts["PROJ-121"] = { type: "Bug" }
    const setup = await renderSurface(state, () => (
      <box flexDirection="row" width="100%">
        <box flexGrow={1}><IssueDetailRoute /></box>
        <IssueInspector compact={false} />
      </box>
    ), 180, 44)
    const frame = setup.captureCharFrame()

    expect(frame).toContain("! Bug")
    expect(frame).toContain("○ To Do")
    expect(frame).toContain("– Medium")
    expect(frame).toContain("↑ Authentication platform refresh")
    expect(state.issues["PROJ-121"]?.type).toBe("Task")
    expect(state.issueDrafts["PROJ-121"]?.type).toBe("Bug")
  })
})

async function renderSurface(state: ReturnType<typeof createInitialAppState>, surface: () => JSX.Element, width: number, height: number) {
  const setup = await createTestRenderer({ width, height })
  renderers.push(setup.renderer)
  const keymap = createDefaultOpenTuiKeymap(setup.renderer)
  await render(() => (
    <LazyJiraKeymapProvider keymap={keymap}>
      <AppProviders
        config={{ appName: "lazyjira", runtimeEnv: "dev" }}
        initialState={state}
        source={createDevWorkspaceSource()}
        saveWorkspaceConfig={async () => undefined}
        onExit={() => undefined}
      >
        {surface()}
      </AppProviders>
    </LazyJiraKeymapProvider>
  ), setup.renderer)
  await setup.flush()
  return setup
}
