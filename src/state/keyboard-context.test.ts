import { describe, expect, test } from "bun:test"
import { createInitialAppState } from "./initial"
import { halfViewportRows, routeBindingsBlocked } from "./keyboard-context"
import { loadDevWorkspaceFixture } from "../workspace/dev/fixtures"

describe("route binding ownership", () => {
  test("allows route bindings only when no popup, dialog, or editor owns input", () => {
    const state = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
    expect(routeBindingsBlocked(state)).toBe(false)

    const blockedStates = [
      () => { state.authOnboarding.open = true },
      () => { state.commandPaletteOpen = true },
      () => { state.commentEditing = true },
      () => { state.configEditing = { action: "add", sectionId: "statuses" } },
      () => { state.detailBodyEditing = true },
      () => { state.helpOpen = true },
      () => { state.iconModePickerOpen = true },
      () => { state.inspectorEditingFieldId = "title" },
      () => { state.pendingDeleteIssueKey = "PROJ-1" },
      () => { state.projectPicker.open = true },
      () => { state.remoteApplyOpen = true },
      () => { state.searchOpen = true },
      () => { state.stagedDiscardOpen = true },
    ]

    for (const block of blockedStates) {
      const candidate = createInitialAppState(structuredClone(loadDevWorkspaceFixture("PROJ")), "dev")
      Object.assign(state, candidate)
      block()
      expect(routeBindingsBlocked(state)).toBe(true)
    }
  })

  test("computes a bounded half viewport step", () => {
    expect(halfViewportRows(0)).toBe(1)
    expect(halfViewportRows(1)).toBe(1)
    expect(halfViewportRows(9)).toBe(4)
    expect(halfViewportRows(10)).toBe(5)
  })
})
