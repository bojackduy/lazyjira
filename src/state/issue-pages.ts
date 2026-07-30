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

export function issuePageStatusText(page: IssuePageState, subject = "Jira issues") {
  const loaded = loadedIssueCount(page)
  const count = `${loaded}${typeof page.total === "number" ? `/${page.total}` : ""}`
  if (page.refreshing) return `Refreshing ${subject} · ${count} retained...`
  if (page.loading) return loaded ? `Loading more ${subject}...` : `Loading ${subject}...`
  if (page.error) return `${loaded ? "Load more" : "Load"} failed: ${page.error}`
  if (page.isLast && !loaded) return `Jira returned no ${subject.replace(/^Jira /, "")}`
  if (page.isLast) return `Loaded ${count} ${subject}`
  return `Loaded ${count} ${subject} · L load more`
}
