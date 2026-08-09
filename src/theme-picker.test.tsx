import { afterEach, describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { App } from "./app"
import { useAppState, type AppStateContext } from "./context/app-state"
import { LazyJiraKeymapProvider } from "./context/keymap"
import { AppProviders } from "./context/providers"
import { useTheme, useThemeContext } from "./context/theme"
import { builtInThemes } from "./themes/catalog"
import { createInitialAppState } from "./state/initial"
import { loadDevWorkspaceFixture } from "./workspace/dev/fixtures"
import { createDevWorkspaceSource } from "./workspace/dev/source"

async function waitForOpen(appState: AppStateContext | undefined, expected: boolean) {
  const deadline = Date.now() + 1000
  while (Date.now() < deadline) {
    if (appState?.state.themePickerOpen === expected) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  expect(appState?.state.themePickerOpen).toBe(expected)
}

const renderers: Array<Awaited<ReturnType<typeof createTestRenderer>>["renderer"]> = []

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()
    if (renderer && !renderer.isDestroyed) renderer.destroy()
  }
})

describe("theme picker flow", () => {
  test("opens with T, previews with j, and applies + saves with Enter", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.themePickerCatalog = builtInThemes.map((theme) => ({ ...theme, source: "built-in" }))

    let appState: AppStateContext | undefined
    const saved: string[] = []

    function Capture() {
      const { state } = useAppState()
      appState = useAppState()
      const theme = useTheme()
      return <text>probe-id={useThemeContext().selectedTheme.id} probe-bg={theme.background}</text>
    }

    const setup = await createTestRenderer({ width: 120, height: 24 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          saveTheme={async (theme) => { saved.push(theme.id) }}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    expect(setup.captureCharFrame()).toContain("probe-id=midnight")
    expect(setup.captureCharFrame()).toContain("probe-bg=#0B1020")

    setup.mockInput.pressKey("t", { shift: true })
    await setup.flush()
    expect(appState!.state.themePickerOpen).toBe(true)

    setup.mockInput.pressKey("j")
    await setup.flush()
    expect(appState!.state.themePickerSelectedIndex).toBe(1)
    expect(setup.captureCharFrame()).toContain("probe-id=catppuccin-mocha")
    expect(setup.captureCharFrame()).toContain("probe-bg=#1E1E2E")
    expect(saved).toEqual([])

    setup.mockInput.pressKey("\r")
    await waitForOpen(appState, false)
    expect(saved).toEqual(["catppuccin-mocha"])
    expect(appState!.state.themePickerOpen).toBe(false)
    expect(setup.captureCharFrame()).toContain("probe-id=catppuccin-mocha")
    expect(setup.captureCharFrame()).toContain("probe-bg=#1E1E2E")
  })

  test("Esc closes the picker without changing or saving the theme", async () => {
    const initialState = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    initialState.themePickerCatalog = builtInThemes.map((theme) => ({ ...theme, source: "built-in" }))
    initialState.themePickerSelectedIndex = 1

    let appState: AppStateContext | undefined
    const saved: string[] = []

    function Capture() {
      const { state } = useAppState()
      appState = useAppState()
      return <text>probe-id={useThemeContext().selectedTheme.id}</text>
    }

    const setup = await createTestRenderer({ width: 120, height: 24 })
    renderers.push(setup.renderer)
    const keymap = createDefaultOpenTuiKeymap(setup.renderer)

    await render(() => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={{ appName: "lazyjira", runtimeEnv: "dev" }}
          initialState={initialState}
          source={createDevWorkspaceSource()}
          saveWorkspaceConfig={async () => undefined}
          saveTheme={async (theme) => { saved.push(theme.id) }}
          iconMode="ascii"
          onExit={() => undefined}
        >
          <Capture />
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ), setup.renderer)
    await setup.flush()

    setup.mockInput.pressKey("t", { shift: true })
    await setup.flush()
    expect(appState!.state.themePickerOpen).toBe(true)

    setup.mockInput.pressKey("\u001b")
    await waitForOpen(appState, false)
    expect(appState!.state.themePickerOpen).toBe(false)
    expect(setup.captureCharFrame()).toContain("probe-id=midnight")
    expect(saved).toEqual([])
  })
})
