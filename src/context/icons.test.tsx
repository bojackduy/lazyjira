import { describe, expect, test } from "bun:test"
import { createComponent, createRoot } from "solid-js"
import { IconProvider, useIcons } from "./icons"
import type { IconSelector } from "../icons/catalog"

describe("icon context", () => {
  test("exposes the safely selected catalog through one provider boundary", () => {
    let selected: IconSelector | undefined
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
})
