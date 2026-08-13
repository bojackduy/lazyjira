import type { IssuePageState } from "./app-state"

export const backlogIssuePageSourceId = "backlog"
export const boardIssuePageSourceId = "board"
export const remoteSearchIssuePageSourceId = "remote-search"
export const projectListIssuePageSourceId = "project-list"

export function sprintIssuePageSourceId(sprintId: string) {
  return `sprint:${sprintId}`
}

export function defaultIssuePageState(sourceId: string, maxResults = 100): IssuePageState {
  return {
    sourceId,
    startAt: 0,
    maxResults,
    isLast: false,
    loading: false,
  }
}

export function loadedIssueCount(page: IssuePageState | undefined) {
  if (!page) return 0
  return typeof page.total === "number" ? Math.min(page.startAt, page.total) : page.startAt
}

export function issuePageCanLoadMore(page: IssuePageState | undefined) {
  return !page || (!page.loading && !page.isLast)
}

export function issuePageActionVisible(page: IssuePageState | undefined) {
  return !!page && !page.isLast && loadedIssueCount(page) > 0
}

export function issuePageNextCount(page: IssuePageState) {
  const remaining = typeof page.total === "number" ? Math.max(0, page.total - loadedIssueCount(page)) : page.maxResults
  return Math.min(page.maxResults, remaining || page.maxResults)
}

export function partialResultsBannerText(page: IssuePageState) {
  if (!issuePageActionVisible(page)) return undefined
  const loaded = loadedIssueCount(page)
  const count = `${loaded}${typeof page.total === "number" ? `/${page.total}` : ""}`
  const state = page.loading
    ? `LOADING NEXT ${issuePageNextCount(page)}...`
    : page.error
      ? "LOAD FAILED · [L] RETRY"
      : `AUTO-LOADS NEXT ${issuePageNextCount(page)} ON SCROLL`
  return `! PARTIAL RESULTS · ${count} loaded · ${state} · [S] SEARCH ALL JIRA`
}

export function loadMoreActionText(page: IssuePageState) {
  if (page.loading) return `Loading next ${issuePageNextCount(page)}...`
  if (page.error) return `[L] RETRY · Load next ${issuePageNextCount(page)}`
  return `[L] LOAD NEXT ${issuePageNextCount(page)}`
}

export function issuePageStatusText(page: IssuePageState, subject = "Jira issues") {
  const loaded = loadedIssueCount(page)
  const count = `${loaded}${typeof page.total === "number" ? `/${page.total}` : ""}`
  if (page.refreshing) return `Refreshing ${subject} · ${count} retained...`
  if (page.loading) return loaded ? `Loading more ${subject}...` : `Loading ${subject}...`
  if (page.error) return `${loaded ? "Load more" : "Load"} failed: ${page.error}`
  if (page.isLast && !loaded) return `Jira returned no ${subject.replace(/^Jira /, "")}`
  if (page.isLast) return `Loaded ${count} ${subject}`
  return `Loaded ${count} ${subject} · auto-loads more`
}
