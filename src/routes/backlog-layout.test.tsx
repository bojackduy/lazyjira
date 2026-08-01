import { afterEach, describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { LazyJiraKeymapProvider } from "../context/keymap"
import { AppProviders } from "../context/providers"
import { createInitialAppState } from "../state/initial"
import { loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import { createDevWorkspaceSource } from "../workspace/dev/source"
import { BacklogRoute } from "./backlog"

const renderers: Array<Awaited<ReturnType<typeof createTestRenderer>>["renderer"]> = []

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()
    if (renderer && !renderer.isDestroyed) renderer.destroy()
  }
})

describe("adaptive backlog rows", () => {
  test("uses a content-sized parent badge in a wide row", async () => {
    const frame = await renderBacklog(160)
    const row = frame.split("\n").find((line) => line.includes("PROJ-301")) ?? ""
    const topLevelRow = frame.split("\n").find((line) => line.includes("PROJ-300")) ?? ""

    expect(row).toContain("PROJ-301")
    expect(row).toContain("Timeline foundation")
    expect(row).toContain("↑ PROJ-300")
    expect(row).toContain("◉ In Progress")
    expect(topLevelRow.indexOf("◉ In Progress") - (topLevelRow.indexOf("Workspace navigation program") + "Workspace navigation program".length)).toBeLessThanOrEqual(2)
  })

  test("moves metadata below identity and keeps parent keys visible at medium width", async () => {
    const frame = await renderBacklog(90)
    const lines = frame.split("\n")
    const identityIndex = lines.findIndex((line) => line.includes("PROJ-301"))

    expect(identityIndex).toBeGreaterThan(-1)
    expect(lines[identityIndex]).toContain("Timeline foundation")
    expect(lines[identityIndex + 1]).toContain("◉ In Progress")
    expect(lines[identityIndex + 1]).toContain("↑ PROJ-300")
    expect(lines[identityIndex + 1]).not.toContain("Workspace navigation program")
  })

  test("preserves the full issue key before optional metadata at narrow width", async () => {
    const frame = await renderBacklog(60)
    const lines = frame.split("\n")
    const identityIndex = lines.findIndex((line) => line.includes("PROJ-301"))

    expect(identityIndex).toBeGreaterThan(-1)
    expect(lines[identityIndex]).toContain("PROJ-301")
    expect(lines[identityIndex + 1]).toContain("◉ In Progress")
    expect(lines[identityIndex + 1]).not.toContain("PROJ-300")
  })

  test("replans existing rows after a terminal resize", async () => {
    const setup = await mountBacklog(160)
    expect((setup.captureCharFrame().split("\n").find((line) => line.includes("PROJ-301")) ?? "")).toContain("↑ PROJ-300")

    setup.resize(60, 50)
    await setup.flush()
    await settle(setup)
    const lines = setup.captureCharFrame().split("\n")
    const identityIndex = lines.findIndex((line) => line.includes("PROJ-301"))

    expect(identityIndex).toBeGreaterThan(-1)
    expect(lines[identityIndex]).toContain("PROJ-301")
    expect(lines[identityIndex + 1]).not.toContain("PROJ-300")
  })
})

async function renderBacklog(width: number) {
  const setup = await mountBacklog(width)
  return setup.captureCharFrame()
}

async function mountBacklog(width: number) {
  const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
  state.route = "backlog"
  state.backlogGroupBy = "sprint"
  state.selectedBacklogGroupId = "backlog"
  state.selectedIssueKey = "PROJ-301"
  const setup = await createTestRenderer({ width, height: 50 })
  renderers.push(setup.renderer)
  const keymap = createDefaultOpenTuiKeymap(setup.renderer)

  await render(() => (
    <LazyJiraKeymapProvider keymap={keymap}>
      <AppProviders
        config={{ appName: "lazyjira", runtimeEnv: "dev" }}
        initialState={state}
        source={createDevWorkspaceSource()}
        saveWorkspaceConfig={async () => undefined}
        iconMode="unicode"
        onExit={() => undefined}
      >
        <BacklogRoute />
      </AppProviders>
    </LazyJiraKeymapProvider>
  ), setup.renderer)
  await settle(setup)
  return setup
}

async function settle(setup: Awaited<ReturnType<typeof createTestRenderer>>) {
  await Bun.sleep(25)
  await setup.flush()
}
