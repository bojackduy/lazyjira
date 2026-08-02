import type { IssueRankDraft } from "./app-state"

export function projectRankDrafts(issueKeys: string[], drafts: Record<string, IssueRankDraft>) {
  let projected = [...issueKeys]
  for (const draft of Object.values(drafts)) projected = projectRankDraft(projected, draft)
  return projected
}

export function projectRankDraft(issueKeys: string[], draft: IssueRankDraft) {
  if (draft.issueKey === draft.targetIssueKey || !issueKeys.includes(draft.issueKey) || !issueKeys.includes(draft.targetIssueKey)) return [...issueKeys]
  const projected = issueKeys.filter((issueKey) => issueKey !== draft.issueKey)
  const targetIndex = projected.indexOf(draft.targetIssueKey)
  projected.splice(targetIndex + (draft.position === "after" ? 1 : 0), 0, draft.issueKey)
  return projected
}

export function materializeRankDraft(issueKeysBySource: Record<string, string[]>, draft: IssueRankDraft) {
  return Object.fromEntries(Object.entries(issueKeysBySource).map(([sourceId, issueKeys]) => [sourceId, projectRankDraft(issueKeys, draft)]))
}
