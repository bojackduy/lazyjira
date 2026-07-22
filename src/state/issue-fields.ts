import type { AppState, IssueEditableField, IssueSummary } from "./app-state"
import { configuredIssueTypes, configuredStatuses } from "./config-drafts"
import { applyIssueDraft, issueWithDraft } from "./issue-drafts"
import { issueTypeColor, statusColor, statusName } from "./selectors"

export { applyIssueDraft }

export type IssueFieldDefinition = {
  id: IssueEditableField | "key" | "createdAt" | "updatedAt" | "rank" | "resolution"
  label: string
  editable: boolean
  multiline?: boolean
  value: (issue: IssueSummary, state: AppState) => string
}

export const issueFields: IssueFieldDefinition[] = [
  { id: "key", label: "Key", editable: false, value: (issue) => issue.key },
  { id: "title", label: "Summary", editable: true, value: (issue) => issue.title },
  { id: "type", label: "Type", editable: true, value: (issue) => issue.type },
  { id: "statusId", label: "Status", editable: true, value: (issue, state) => statusName(state, issue) },
  { id: "priority", label: "Priority", editable: true, value: (issue) => issue.priority },
  { id: "assignee", label: "Assignee", editable: true, value: (issue) => issue.assignee },
  { id: "reporter", label: "Reporter", editable: true, value: (issue) => issue.reporter },
  { id: "sprintId", label: "Sprint", editable: true, value: (issue, state) => state.sprints.find((sprint) => sprint.id === issue.sprintId)?.name ?? "Backlog" },
  { id: "parentKey", label: "Parent", editable: true, value: (issue) => issue.parentKey ?? "" },
  { id: "storyPoints", label: "Story Points", editable: true, value: (issue) => String(issue.storyPoints ?? "") },
  { id: "estimate", label: "Estimate", editable: true, value: (issue) => String(issue.estimate ?? "") },
  { id: "dueDate", label: "Due Date", editable: true, value: (issue) => issue.dueDate ?? "" },
  { id: "epic", label: "Epic", editable: true, value: (issue) => issue.epic ?? "" },
  { id: "feature", label: "Feature", editable: true, value: (issue) => issue.feature ?? "" },
  { id: "space", label: "Space", editable: true, value: (issue) => issue.space ?? "" },
  { id: "labels", label: "Labels", editable: true, value: (issue) => issue.labels.join(", ") },
  { id: "components", label: "Components", editable: true, value: (issue) => issue.components.join(", ") },
  { id: "fixVersions", label: "Fix Versions", editable: true, value: (issue) => (issue.fixVersions ?? []).join(", ") },
  { id: "affectsVersions", label: "Affects Versions", editable: true, value: (issue) => (issue.affectsVersions ?? []).join(", ") },
  { id: "links", label: "Links", editable: true, value: (issue) => issue.links.join(", ") },
  { id: "blocked", label: "Blocked", editable: true, value: (issue) => (issue.blocked ? "yes" : "no") },
  { id: "createdAt", label: "Created", editable: false, value: (issue) => issue.createdAt ?? "" },
  { id: "updatedAt", label: "Updated", editable: false, value: (issue) => issue.updatedAt ?? "" },
  { id: "rank", label: "Rank", editable: false, value: (issue) => issue.rank ?? "" },
  { id: "resolution", label: "Resolution", editable: false, value: (issue) => issue.resolution ?? "Unresolved" },
]

export function issueFieldDisplayValue(state: AppState, issue: IssueSummary, field: IssueFieldDefinition) {
  const draftValue = isEditableField(field.id) ? state.issueDrafts[issue.key]?.[field.id] : undefined
  if (draftValue !== undefined && field.id === "statusId") return configuredStatuses(state).find((status) => status.id === draftValue)?.name ?? draftValue
  if (draftValue !== undefined && field.id === "type") return configuredIssueTypes(state).find((type) => type.id === draftValue)?.name ?? draftValue
  return draftValue ?? field.value(issue, state)
}

export function issueFieldColor(state: AppState, issue: IssueSummary, field: IssueFieldDefinition) {
  const renderedIssue = issueWithDraft(state, issue)
  if (field.id === "statusId") return statusColor(state, renderedIssue)
  if (field.id === "type") return issueTypeColor(state, renderedIssue)
  return undefined
}

export function selectedIssueField(state: AppState) {
  const index = Math.max(0, Math.min(state.inspectorSelectedFieldIndex, issueFields.length - 1))
  return issueFields[index]
}

export function isEditableField(fieldId: IssueFieldDefinition["id"]): fieldId is IssueEditableField {
  return !["key", "createdAt", "updatedAt", "rank", "resolution"].includes(fieldId)
}
