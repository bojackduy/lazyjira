import { describe, expect, test } from "bun:test"
import { createComponent, createRoot } from "solid-js"
import { IconProvider, useIcons } from "./icons"
import type { IconContext } from "./icons"

describe("icon context", () => {
  test("exposes the safely selected catalog through one provider boundary", () => {
    let selected: IconContext | undefined
    createRoot((dispose) => {
      const Capture = () => {
        selected = useIcons()
        return null
      }
      createComponent(IconProvider, {
        mode: "unsupported",
        get children() {
          return createComponent(Capture, {})
        },
      })
      dispose()
    })

    expect(selected?.mode).toBe("unicode")
    expect(selected?.catalog.mode).toBe("unicode")
  })

  test("switches profiles immediately and persists the resolved mode", async () => {
    let selected: IconContext | undefined
    const persisted: string[] = []
    let cleanup = () => {}
    createRoot((dispose) => {
      cleanup = dispose
      const Capture = () => {
        selected = useIcons()
        return null
      }
      createComponent(IconProvider, {
        mode: "unicode",
        onModeChange: async (mode) => { persisted.push(mode) },
        get children() {
          return createComponent(Capture, {})
        },
      })
    })

    expect(selected?.mode).toBe("unicode")
    await selected?.setMode("ascii")
    expect(selected?.mode).toBe("ascii")
    expect(selected?.catalog.structural.selection).toBe(">")
    expect(persisted).toEqual(["ascii"])
    cleanup()
  })

  test("keeps an environment-locked profile active", async () => {
    let selected: IconContext | undefined
    createRoot((dispose) => {
      const Capture = () => {
        selected = useIcons()
        return null
      }
      createComponent(IconProvider, {
        mode: "unicode",
        locked: true,
        get children() {
          return createComponent(Capture, {})
        },
      })
      dispose()
    })

    await selected?.setMode("nerd")
    expect(selected?.locked).toBe(true)
    expect(selected?.mode).toBe("unicode")
  })
})
