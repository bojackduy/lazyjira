import type { AppState, IssueDraft, IssueEditableField, IssueSummary } from "./app-state"
import { issueTypeColor, statusColor, statusName } from "./selectors"

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
  { id: "description", label: "Body", editable: true, multiline: true, value: (issue) => issue.description },
]

export function issueFieldDisplayValue(state: AppState, issue: IssueSummary, field: IssueFieldDefinition) {
  const draftValue = isEditableField(field.id) ? state.issueDrafts[issue.key]?.[field.id] : undefined
  if (draftValue !== undefined && field.id === "statusId") return state.statuses.find((status) => status.id === draftValue)?.name ?? draftValue
  if (draftValue !== undefined && field.id === "type") return state.issueTypes.find((type) => type.id === draftValue)?.name ?? draftValue
  return draftValue ?? field.value(issue, state)
}

export function issueFieldColor(state: AppState, issue: IssueSummary, field: IssueFieldDefinition) {
  if (field.id === "statusId") return statusColor(state, issueWithDraftValue(issue, "statusId", state.issueDrafts[issue.key]?.statusId))
  if (field.id === "type") return issueTypeColor(state, issueWithDraftValue(issue, "type", state.issueDrafts[issue.key]?.type))
  return undefined
}

export function selectedIssueField(state: AppState) {
  const index = Math.max(0, Math.min(state.inspectorSelectedFieldIndex, issueFields.length - 1))
  return issueFields[index]
}

export function isEditableField(fieldId: IssueFieldDefinition["id"]): fieldId is IssueEditableField {
  return !["key", "createdAt", "updatedAt", "rank", "resolution"].includes(fieldId)
}

export function applyIssueDraft(issue: IssueSummary, draft: IssueDraft, state: AppState): IssueSummary {
  let next = { ...issue }
  for (const [fieldId, value] of Object.entries(draft) as [IssueEditableField, string][]) {
    next = applyIssueField(next, fieldId, value, state)
  }
  return { ...next, isDraft: false, updatedAt: "now" }
}

function applyIssueField(issue: IssueSummary, fieldId: IssueEditableField, value: string, state: AppState): IssueSummary {
  const trimmed = value.trim()
  switch (fieldId) {
    case "title":
      return { ...issue, title: value || "Untitled issue" }
    case "type":
      return { ...issue, type: state.issueTypes.find((type) => type.id.toLowerCase() === trimmed.toLowerCase())?.id ?? issue.type }
    case "statusId":
      return { ...issue, statusId: state.statuses.find((status) => status.id === trimmed || status.name.toLowerCase() === trimmed.toLowerCase())?.id ?? issue.statusId }
    case "priority":
      return { ...issue, priority: priorityValue(trimmed) ?? issue.priority }
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

function issueWithDraftValue(issue: IssueSummary, fieldId: "statusId" | "type", value?: string): IssueSummary {
  if (!value) return issue
  return { ...issue, [fieldId]: value }
}

function priorityValue(value: string) {
  if (["Low", "Medium", "High", "Critical"].includes(value)) return value as IssueSummary["priority"]
  const match = ["Low", "Medium", "High", "Critical"].find((priority) => priority.toLowerCase() === value.toLowerCase())
  return match as IssueSummary["priority"] | undefined
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}
