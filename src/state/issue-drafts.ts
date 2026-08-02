import type { AppState, IssueDraft, IssueEditableField, IssueSummary } from "./app-state"
import { configuredIssueTypes, configuredStatuses } from "./config-drafts"

export function issueByKey(state: AppState, issueKey: string) {
  const issue = state.issues[issueKey]
  return issue ? issueWithDraft(state, issue) : undefined
}

export function issueWithDraft(state: AppState, issue: IssueSummary): IssueSummary {
  const draft = state.issueDrafts[issue.key]
  return draft ? applyDraftFields(issue, draft, state) : issue
}

export function applyIssueDraft(issue: IssueSummary, draft: IssueDraft, state: AppState): IssueSummary {
  return { ...applyDraftFields(issue, draft, state), isDraft: false, updatedAt: "now" }
}

function applyDraftFields(issue: IssueSummary, draft: IssueDraft, state: AppState): IssueSummary {
  let next = { ...issue }
  for (const [fieldId, value] of Object.entries(draft) as [IssueEditableField, string][]) {
    next = applyIssueField(next, fieldId, value, state)
  }
  return next
}

function applyIssueField(issue: IssueSummary, fieldId: IssueEditableField, value: string, state: AppState): IssueSummary {
  const trimmed = value.trim()
  switch (fieldId) {
    case "title":
      return { ...issue, title: value || "Untitled issue" }
    case "type":
      return { ...issue, type: configuredIssueTypes(state).find((type) => type.id.toLowerCase() === trimmed.toLowerCase() || type.name.toLowerCase() === trimmed.toLowerCase())?.id ?? issue.type }
    case "statusId":
      return { ...issue, statusId: configuredStatuses(state).find((status) => status.id === trimmed || status.name.toLowerCase() === trimmed.toLowerCase())?.id ?? issue.statusId }
    case "priority":
      return { ...issue, priority: trimmed || issue.priority, priorityColor: trimmed && trimmed !== issue.priority ? undefined : issue.priorityColor }
    case "assignee":
    case "reporter":
    case "parentKey":
    case "dueDate":
    case "epic":
    case "feature":
    case "space":
    case "description":
      return { ...issue, [fieldId]: value }
    case "sprintId":
      return { ...issue, sprintId: state.sprints.find((sprint) => sprint.id === trimmed || sprint.name.toLowerCase() === trimmed.toLowerCase())?.id ?? (trimmed || undefined) }
    case "storyPoints":
    case "estimate":
      return { ...issue, [fieldId]: trimmed ? Number(trimmed) || 0 : undefined }
    case "labels":
    case "components":
    case "fixVersions":
    case "affectsVersions":
    case "links":
      return { ...issue, [fieldId]: splitList(value) }
    case "blocked":
      return { ...issue, blocked: ["1", "true", "yes", "y", "blocked"].includes(trimmed.toLowerCase()) }
  }
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}
