import type { IssuePageState } from "./app-state"

export const backlogIssuePageSourceId = "backlog"
export const boardIssuePageSourceId = "board"
export const remoteSearchIssuePageSourceId = "remote-search"

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
