import type { AppState, IssueEditableField, IssueSummary, ParentIssueSummary } from "./app-state"
import { configuredIssueTypes, configuredStatuses } from "./config-drafts"
import { applyIssueDraft, issueWithDraft } from "./issue-drafts"
import { groupBacklogIssues, issueColor, issueTypeColor, issueTypeName, parentIssueColor, priorityColor, statusColor, statusName } from "./selectors"

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
  { id: "type", label: "Type", editable: true, value: (issue, state) => issueTypeName(state, issue) },
  { id: "statusId", label: "Status", editable: true, value: (issue, state) => statusName(state, issue) },
  { id: "priority", label: "Priority", editable: true, value: (issue) => issue.priority },
  { id: "assignee", label: "Assignee", editable: true, value: (issue) => issue.assignee },
  { id: "reporter", label: "Reporter", editable: true, value: (issue) => issue.reporter },
  { id: "sprintId", label: "Sprint", editable: true, value: (issue, state) => state.sprints.find((sprint) => sprint.id === issue.sprintId)?.name ?? "Backlog" },
  { id: "parentKey", label: "Parent", editable: true, value: (issue) => issue.parent?.title ? `${issue.parent.key} ${issue.parent.title}` : issue.parentKey ?? "" },
  { id: "storyPoints", label: "Story Points", editable: true, value: (issue) => String(issue.storyPoints ?? "") },
  { id: "estimate", label: "Estimate", editable: true, value: (issue) => String(issue.estimate ?? "") },
  { id: "dueDate", label: "Due Date", editable: true, value: (issue) => issue.dueDate ?? "" },
  { id: "epic", label: "Epic", editable: false, value: (issue, state) => hierarchyValue(state, issue, "epic") ?? issue.epic ?? "" },
  { id: "feature", label: "Feature", editable: false, value: (issue, state) => hierarchyValue(state, issue, "feature") ?? issue.feature ?? "" },
  { id: "space", label: "Space", editable: true, value: (issue) => issue.space ?? "" },
  { id: "labels", label: "Labels", editable: true, value: (issue) => issue.labels.join(", ") },
  { id: "components", label: "Components", editable: true, value: (issue) => issue.components.join(", ") },
  { id: "fixVersions", label: "Fix Versions", editable: true, value: (issue) => (issue.fixVersions ?? []).join(", ") },
  { id: "affectsVersions", label: "Affects Versions", editable: true, value: (issue) => (issue.affectsVersions ?? []).join(", ") },
  { id: "links", label: "Links", editable: true, value: (issue) => issue.links.join(", ") },
  { id: "blocked", label: "Blocked", editable: true, value: (issue) => (issue.blocked ? "yes" : "no") },
  { id: "createdAt", label: "Created", editable: false, value: (issue) => issue.createdAt ?? "" },
  { id: "updatedAt", label: "Updated", editable: false, value: (issue) => issue.updatedAt ?? "" },
  { id: "rank", label: "Backlog Order", editable: false, value: (issue, state) => backlogOrderValue(state, issue) },
  { id: "resolution", label: "Resolution", editable: false, value: (issue) => issue.resolution ?? "Unresolved" },
]

export function issueFieldDisplayValue(state: AppState, issue: IssueSummary, field: IssueFieldDefinition) {
  const draftValue = isEditableField(field.id) ? state.issueDrafts[issue.key]?.[field.id] : undefined
  if (draftValue !== undefined && field.id === "statusId") return configuredStatuses(state).find((status) => status.id === draftValue)?.name ?? draftValue
  if (draftValue !== undefined && field.id === "type") return issueTypeName(state, issueWithDraft(state, issue))
  return draftValue ?? field.value(issue, state)
}

export function issueFieldColor(state: AppState, issue: IssueSummary, field: IssueFieldDefinition) {
  const renderedIssue = issueWithDraft(state, issue)
  if (field.id === "statusId") return statusColor(state, renderedIssue)
  if (field.id === "type") return issueTypeColor(state, renderedIssue)
  if (field.id === "priority") return priorityColor(renderedIssue)
  if (field.id === "parentKey") {
    const parentKey = renderedIssue.parentKey ?? renderedIssue.parent?.key
    const parent = parentKey ? state.issues[parentKey] ?? renderedIssue.parent : undefined
    return parent ? parentIssueColor(state, parent) : undefined
  }
  return undefined
}

export function parentIssueChoices(state: AppState, issue: IssueSummary) {
  const issueType = configuredIssueTypes(state).find((type) => type.id === issue.type || type.name === issue.type)
  return Object.values(state.issues)
    .filter((candidate) => candidate.key !== issue.key)
    .filter((candidate) => {
      const candidateType = configuredIssueTypes(state).find((type) => type.id === candidate.type || type.name === candidate.type)
      return issueType?.hierarchyLevel === undefined || candidateType?.hierarchyLevel === undefined || candidateType.hierarchyLevel > issueType.hierarchyLevel
    })
    .map((candidate) => ({ value: candidate.key, label: `${candidate.key} ${candidate.title}`, color: issueColor(state, candidate) }))
}

export function selectedIssueField(state: AppState) {
  const index = Math.max(0, Math.min(state.inspectorSelectedFieldIndex, issueFields.length - 1))
  return issueFields[index]
}

export function isEditableField(fieldId: IssueFieldDefinition["id"]): fieldId is IssueEditableField {
  return !["key", "epic", "feature", "createdAt", "updatedAt", "rank", "resolution"].includes(fieldId)
}

function hierarchyValue(state: AppState, issue: IssueSummary, expectedType: "epic" | "feature") {
  const seen = new Set<string>()
  let parentKey = issue.parentKey ?? issue.parent?.key
  let inlineParent = issue.parent
  while (parentKey && !seen.has(parentKey)) {
    seen.add(parentKey)
    const loadedAncestor = state.issues[parentKey]
    const ancestor: IssueSummary | ParentIssueSummary | undefined = loadedAncestor ?? (inlineParent?.key === parentKey ? inlineParent : undefined)
    if (!ancestor) break
    const typeName = loadedAncestor ? issueTypeName(state, loadedAncestor) : ancestor.typeName ?? ancestor.type ?? ""
    if (typeName.toLowerCase().includes(expectedType)) return `${ancestor.key}${ancestor.title ? ` ${ancestor.title}` : ""}`
    parentKey = loadedAncestor?.parentKey ?? loadedAncestor?.parent?.key
    inlineParent = loadedAncestor?.parent
  }
  return undefined
}

function backlogOrderValue(state: AppState, issue: IssueSummary) {
  const group = groupBacklogIssues(state, state.backlogGroupBy).find((candidate) => candidate.issueKeys.includes(issue.key))
  const index = group?.issueKeys.indexOf(issue.key) ?? -1
  if (group && index >= 0) return `${index + 1} in loaded ${group.label}`
  return issue.rank ? "Managed by Jira" : "Unavailable"
}
