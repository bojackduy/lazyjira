import { afterEach, describe, expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { render } from "@opentui/solid"
import { onMount } from "solid-js"
import { ThemeProvider, useTheme, useThemeContext } from "./theme"
import { builtInThemes } from "../themes/catalog"

const renderers: Array<Awaited<ReturnType<typeof createTestRenderer>>["renderer"]> = []

afterEach(() => {
  while (renderers.length) {
    const renderer = renderers.pop()
    if (renderer && !renderer.isDestroyed) renderer.destroy()
  }
})

describe("reactive theme context", () => {
  test("repaints the full palette when the active theme changes", async () => {
    let applyCatppuccin: (() => void) | undefined
    const setup = await createTestRenderer({ width: 60, height: 10 })
    renderers.push(setup.renderer)

    function Probe() {
      const theme = useTheme()
      const { setTheme } = useThemeContext()
      onMount(() => {
        applyCatppuccin = () => setTheme(builtInThemes.find((theme) => theme.id === "catppuccin-mocha")!)
      })
      return <text>bg={theme.background} border={theme.border} accent={theme.accent}</text>
    }

    await render(() => <ThemeProvider><Probe /></ThemeProvider>, setup.renderer)
    await setup.flush()

    const before = setup.captureCharFrame()
    expect(before).toContain("bg=#0B1020")
    expect(before).toContain("accent=#38BDF8")

    applyCatppuccin?.()
    await setup.flush()

    const after = setup.captureCharFrame()
    expect(after).toContain("bg=#1E1E2E")
    expect(after).toContain("border=#313244")
    expect(after).toContain("accent=#89B4FA")
    expect(after).not.toContain("bg=#0B1020")
  })

  test("starts from the provided theme value", async () => {
    const setup = await createTestRenderer({ width: 60, height: 10 })
    renderers.push(setup.renderer)

    function Probe() {
      const theme = useTheme()
      return <text>bg={theme.background}</text>
    }

    const catppuccin = builtInThemes.find((theme) => theme.id === "catppuccin-mocha")!
    await render(() => <ThemeProvider value={catppuccin}><Probe /></ThemeProvider>, setup.renderer)
    await setup.flush()

    expect(setup.captureCharFrame()).toContain("bg=#1E1E2E")
  })
})
