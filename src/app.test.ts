import { describe, expect, test } from "bun:test"
import { browserOpenCommand, bugReportUrl } from "./app"

describe("browser issue action", () => {
  test("uses the platform browser launcher without shell interpolation", () => {
    const url = "https://example.atlassian.net/browse/PROJ-1"
    expect(browserOpenCommand(url, "darwin")).toEqual(["open", url])
    expect(browserOpenCommand(url, "linux")).toEqual(["xdg-open", url])
    expect(browserOpenCommand(url, "win32")).toEqual(["cmd", "/c", "start", "", url])
  })

  test("builds a prefilled GitHub bug report without Jira content", () => {
    const url = new URL(bugReportUrl({ runtimeLabel: "prod" }))

    expect(url.origin + url.pathname).toBe("https://github.com/bojackduy/lazyjira/issues/new")
    expect(url.searchParams.get("title")).toBe("bug: ")
    expect(url.searchParams.get("body")).toContain("## Steps to reproduce")
    expect(url.searchParams.get("body")).toContain("runtime: prod")
    expect(url.searchParams.get("body")).toContain("Do not include API tokens")
  })
})
