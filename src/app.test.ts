import { describe, expect, test } from "bun:test"
import { browserOpenCommand } from "./app"

describe("browser issue action", () => {
  test("uses the platform browser launcher without shell interpolation", () => {
    const url = "https://example.atlassian.net/browse/PROJ-1"
    expect(browserOpenCommand(url, "darwin")).toEqual(["open", url])
    expect(browserOpenCommand(url, "linux")).toEqual(["xdg-open", url])
    expect(browserOpenCommand(url, "win32")).toEqual(["cmd", "/c", "start", "", url])
  })
})
