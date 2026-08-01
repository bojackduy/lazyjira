import { afterEach, describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { IconProvider } from "../context/icons"
import { LazyJiraKeymapProvider } from "../context/keymap"
import { AppProviders } from "../context/providers"
import type { IconMode } from "../icons/catalog"
import { createInitialAppState } from "../state/initial"
import { loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import { createDevWorkspaceSource } from "../workspace/dev/source"
import { AppShell } from "./shell"

const renderers: Array<Awaited<ReturnType<typeof createTestRenderer>>["renderer"]> = []

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()
    if (renderer && !renderer.isDestroyed) renderer.destroy()
  }
})

describe("shell navigation and action icons", () => {
  test("keeps ASCII route and loading labels aligned in a narrow terminal", async () => {
    const frame = await renderShell("ascii", (state) => {
      state.route = "workspace"
      state.sidebarSelectedIndex = 0
      state.workspaceLoading = true
      state.issues = {}
    }, 80)

    expect(frame).toContain("> W Workspace")
    expect(frame).toContain("W Workspace")
    expect(frame).toContain("* Loading Jira workspace")
    expect(frame).toContain("+ 0 staged changes")
  })

  test("keeps Unicode apply warnings text-complete in a narrow terminal", async () => {
    const frame = await renderShell("unicode", (state) => {
      state.route = "workspace"
      state.remoteApplyOpen = true
    }, 72)

    expect(frame).toContain("✓ Apply To Jira")
    expect(frame).toContain("Review planned Jira operations before any remote mutation is")
    expect(frame).toContain("enabled.")
    expect(frame).toContain("⚠ Delete operations require a second W confirmation.")
  })

  test("renders the Nerd route profile without changing route labels", async () => {
    const frame = await renderShell("nerd", (state) => {
      state.route = "workspace"
      state.sidebarSelectedIndex = 0
    }, 120)

    expect(frame).toContain("\uf0da \uf015 Workspace")
    expect(frame).toContain("\uf0d0 Timeline")
    expect(frame).toContain("\uf03a Backlog")
    expect(frame).toContain("\uf00a Board")
  })

  test("uses ASCII config and staged icons without dropping labels", async () => {
    const frame = await renderShell("ascii", (state) => {
      state.route = "config"
      state.focusedPane = "main"
    }, 120)

    expect(frame).toContain("C Metadata Config")
    expect(frame).toContain("+ Staged Config")
  })

  test("previews every icon mode without hiding the active profile", async () => {
    const frame = await renderShell("ascii", (state) => {
      state.iconModePickerOpen = true
      state.iconModePickerSelectedIndex = 2
    }, 90)

    expect(frame).toContain("Change Icon Mode")
    expect(frame).toContain("Nerd Font")
    expect(frame).toContain("Unicode")
    expect(frame).toContain("> ASCII")
    expect(frame).toContain("active")
  })

  test("keeps complete Backlog issue keys in the narrow main pane", async () => {
    const frame = await renderShell("unicode", (state) => {
      state.route = "backlog"
      state.focusedPane = "main"
      state.selectedBacklogGroupId = "backlog"
      state.selectedIssueKey = "PROJ-301"
    }, 120)
    const lines = frame.split("\n")
    const identityIndex = lines.findIndex((line) => line.includes("◆ PROJ-301"))

    expect(identityIndex).toBeGreaterThan(-1)
    expect(lines[identityIndex]).toContain("PROJ-301")
    expect(lines[identityIndex + 1]).toContain("↑ PROJ-300 Workspace navigation program")
    expect(lines[identityIndex + 2]).toContain("◉ In Progress")
  })

  test("keeps project picker loading and actionable error text visible", async () => {
    const frame = await renderShell("ascii", (state) => {
      state.projectPicker.open = true
      state.projectPicker.mode = "remote-projects"
      state.projectPicker.loading = true
      state.projectPicker.error = "Jira denied project discovery. Press r to retry."
    }, 90)

    expect(frame).toContain("+ Choose Jira")
    expect(frame).toContain("Project")
    expect(frame).toContain("x Jira denied project discovery. Press r to retry.")
    expect(frame).toContain("* Loading from Jira...")
  })
})

async function renderShell(mode: IconMode, update: (state: ReturnType<typeof createInitialAppState>) => void, width: number) {
  const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
  update(initialState)
  const setup = await createTestRenderer({ width, height: 38 })
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
        <IconProvider mode={mode}>
          <AppShell />
        </IconProvider>
      </AppProviders>
    </LazyJiraKeymapProvider>
  ), setup.renderer)
  await setup.flush()
  return setup.captureCharFrame()
}
