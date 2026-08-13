import { describe, expect, test } from "bun:test"
import { issuePageActionVisible, issuePageNextCount, issuePageStatusText, loadMoreActionText, partialResultsBannerText } from "./issue-pages"

describe("issue page presentation", () => {
  test("distinguishes initial loading, partial, complete, and empty pages", () => {
    expect(issuePageStatusText(page({ loading: true }))).toBe("Loading Jira issues...")
    expect(issuePageStatusText(page({ startAt: 50, total: 120 }))).toBe("Loaded 50/120 Jira issues · auto-loads more")
    expect(issuePageStatusText(page({ startAt: 120, total: 120, isLast: true }))).toBe("Loaded 120/120 Jira issues")
    expect(issuePageStatusText(page({ total: 0, isLast: true }))).toBe("Jira returned no issues")
    expect(issuePageStatusText(page({ startAt: 50, total: 120, loading: true, refreshing: true }))).toBe("Refreshing Jira issues · 50/120 retained...")
  })

  test("keeps initial and append errors actionable", () => {
    expect(issuePageStatusText(page({ error: "Jira 403: Board access denied" }))).toBe("Load failed: Jira 403: Board access denied")
    expect(issuePageStatusText(page({ startAt: 50, total: 120, error: "Jira 429: Retry later" }))).toBe("Load more failed: Jira 429: Retry later")
  })

  test("describes partial pages with banner and action states", () => {
    const partial = page({ startAt: 50, maxResults: 50, total: 482 })
    expect(issuePageActionVisible(partial)).toBe(true)
    expect(issuePageNextCount(partial)).toBe(50)
    expect(partialResultsBannerText(partial)).toBe("! PARTIAL RESULTS · 50/482 loaded · AUTO-LOADS NEXT 50 ON SCROLL · [S] SEARCH ALL JIRA")
    expect(loadMoreActionText(partial)).toBe("[L] LOAD NEXT 50")

    const failed = page({ startAt: 450, maxResults: 50, total: 482, error: "Jira 429" })
    expect(issuePageNextCount(failed)).toBe(32)
    expect(partialResultsBannerText(failed)).toContain("LOAD FAILED · [L] RETRY")
    expect(loadMoreActionText(failed)).toBe("[L] RETRY · Load next 32")
    expect(issuePageActionVisible(page({ startAt: 482, total: 482, isLast: true }))).toBe(false)
  })
})

function page(overrides: Partial<Parameters<typeof issuePageStatusText>[0]>) {
  return { sourceId: "board", startAt: 0, maxResults: 50, isLast: false, loading: false, ...overrides }
}
