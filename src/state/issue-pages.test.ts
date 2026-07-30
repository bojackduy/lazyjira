import { describe, expect, test } from "bun:test"
import { issuePageStatusText } from "./issue-pages"

describe("issue page presentation", () => {
  test("distinguishes initial loading, partial, complete, and empty pages", () => {
    expect(issuePageStatusText(page({ loading: true }))).toBe("Loading Jira issues...")
    expect(issuePageStatusText(page({ startAt: 50, total: 120 }))).toBe("Loaded 50/120 Jira issues · L load more")
    expect(issuePageStatusText(page({ startAt: 120, total: 120, isLast: true }))).toBe("Loaded 120/120 Jira issues")
    expect(issuePageStatusText(page({ total: 0, isLast: true }))).toBe("Jira returned no issues")
    expect(issuePageStatusText(page({ startAt: 50, total: 120, loading: true, refreshing: true }))).toBe("Refreshing Jira issues · 50/120 retained...")
  })

  test("keeps initial and append errors actionable", () => {
    expect(issuePageStatusText(page({ error: "Jira 403: Board access denied" }))).toBe("Load failed: Jira 403: Board access denied")
    expect(issuePageStatusText(page({ startAt: 50, total: 120, error: "Jira 429: Retry later" }))).toBe("Load more failed: Jira 429: Retry later")
  })
})

function page(overrides: Partial<Parameters<typeof issuePageStatusText>[0]>) {
  return { sourceId: "board", startAt: 0, maxResults: 50, isLast: false, loading: false, ...overrides }
}
