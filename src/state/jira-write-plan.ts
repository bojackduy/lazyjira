import type { AppState, IssueEditableField, IssueSummary } from "./app-state"
import { configuredStatuses } from "./config-drafts"
import { issueWithDraft } from "./issue-drafts"
import { stagedChanges, type StagedChange } from "./staged-changes"

export type JiraWritePlanStatus = "planned" | "blocked"
export type JiraWriteOperation = "comment" | "field-update" | "transition" | "sprint-move" | "discovered-field" | "issue-type" | "delete" | "rank"

export type JiraWritePlanItem = {
  id: string
  status: JiraWritePlanStatus
  issueKey?: string
  title: string
  detail: string
  method?: "POST" | "PUT" | "DELETE"
  endpoint?: string
  payloadPreview?: string
  blocker?: string
  commentDraftId?: string
  operation?: JiraWriteOperation
  fieldId?: IssueEditableField
  fieldValue?: string
  fieldAccountId?: string
  transitionStatusId?: string
  sprintId?: string
  discoveredField?: "storyPoints" | "estimate"
  issueType?: string
  rankTargetIssueKey?: string
  rankPosition?: "before" | "after"
}

export function planJiraWrites(state: AppState): JiraWritePlanItem[] {
  const changes = stagedChanges(state)
  const createIssueKeys = new Set(changes.flatMap((change) => change.kind === "create" ? [change.issueKey] : []))
  return changes.flatMap((change) => {
    if (change.kind === "edit" && createIssueKeys.has(change.issueKey)) return []
    return planStagedChange(state, change)
  })
}

export function writePlanCounts(items: JiraWritePlanItem[]) {
  return {
    planned: items.filter((item) => item.status === "planned").length,
    blocked: items.filter((item) => item.status === "blocked").length,
  }
}

function planStagedChange(state: AppState, change: StagedChange): JiraWritePlanItem[] {
  switch (change.kind) {
    case "create":
      return [planCreateIssue(state, change.issueKey)]
    case "edit":
      return [planIssueEdit(state, change)]
    case "comment":
      return [planComment(state, change)]
    case "rank":
      return [planRank(state, change)]
    case "delete":
      return [{
        id: change.id,
        status: "planned",
        issueKey: change.issueKey,
        title: `${change.issueKey} delete issue`,
        detail: "Permanently delete this Jira issue after the second remote confirmation.",
        method: "DELETE",
        endpoint: `/rest/api/3/issue/${change.issueKey}`,
        operation: "delete",
      }]
    case "config":
      return [blockedPlan({
        id: change.id,
        title: "Config metadata write",
        detail: change.value,
        blocker: "Board/status/type config writes are local-only until Jira admin metadata writes are scoped.",
      })]
  }
}

function planComment(state: AppState, change: Extract<StagedChange, { kind: "comment" }>): JiraWritePlanItem {
  const issue = state.issues[change.issueKey]
  if (!issue) return blockedPlan({ id: change.id, issueKey: change.issueKey, title: `${change.issueKey} comment`, detail: "Issue is missing from local state.", blocker: "Cannot post a comment for a missing issue." })
  if (issue.isDraft) return blockedPlan({ id: change.id, issueKey: change.issueKey, title: `${change.issueKey} comment`, detail: commentPreview(change.value), method: "POST", endpoint: `/rest/api/3/issue/${change.issueKey}/comment`, blocker: "Create the draft issue before posting a comment." })
  return {
    id: change.id,
    status: "planned",
    issueKey: change.issueKey,
    title: `${change.issueKey} comment`,
    detail: commentPreview(change.value),
    method: "POST",
    endpoint: `/rest/api/3/issue/${change.issueKey}/comment`,
    payloadPreview: `body = ${commentPreview(change.value)}`,
    commentDraftId: change.commentId,
    operation: "comment",
  }
}

function planRank(state: AppState, change: Extract<StagedChange, { kind: "rank" }>): JiraWritePlanItem {
  const issue = state.issues[change.issueKey]
  const target = state.issues[change.targetIssueKey]
  const detail = `${change.position === "before" ? "Before" : "After"} ${change.targetIssueKey}`
  if (!issue || !target) return blockedPlan({ id: change.id, issueKey: change.issueKey, title: `${change.issueKey} rank`, detail, method: "PUT", endpoint: "/rest/agile/1.0/issue/rank", blocker: "Both ranked issues must still exist in the loaded workspace." })
  if (issue.isDraft || target.isDraft) return blockedPlan({ id: change.id, issueKey: change.issueKey, title: `${change.issueKey} rank`, detail, method: "PUT", endpoint: "/rest/agile/1.0/issue/rank", blocker: "Create draft issues before ranking them." })
  return {
    id: change.id,
    status: "planned",
    issueKey: change.issueKey,
    title: `${change.issueKey} rank`,
    detail,
    method: "PUT",
    endpoint: "/rest/agile/1.0/issue/rank",
    payloadPreview: `issues = [${change.issueKey}], rank${change.position === "before" ? "Before" : "After"}Issue = ${change.targetIssueKey}`,
    operation: "rank",
    rankTargetIssueKey: change.targetIssueKey,
    rankPosition: change.position,
  }
}

function planCreateIssue(state: AppState, issueKey: string): JiraWritePlanItem {
  const issue = state.issues[issueKey]
  const effectiveIssue = issue ? issueWithDraft(state, issue) : undefined
  if (!effectiveIssue) {
    return blockedPlan({ id: `create:${issueKey}`, issueKey, title: `${issueKey} create issue`, detail: "Draft issue is missing from local state.", blocker: "Cannot build a create payload without the draft issue." })
  }
  return blockedPlan({
    id: `create:${issueKey}`,
    issueKey,
    title: `${issueKey} create issue`,
    detail: `${effectiveIssue.type} · ${effectiveIssue.title}`,
    method: "POST",
    endpoint: "/rest/api/3/issue",
    payloadPreview: `project=${state.project.key}, issuetype=${effectiveIssue.type}, summary=${effectiveIssue.title}`,
    blocker: "Create metadata and Jira issue type IDs are not loaded yet.",
  })
}

function planIssueEdit(state: AppState, change: Extract<StagedChange, { kind: "edit" }>): JiraWritePlanItem {
  const issue = state.issues[change.issueKey]
  if (!issue) {
    return blockedPlan({ id: change.id, issueKey: change.issueKey, title: `${change.issueKey} ${change.label}`, detail: "Issue is missing from local state.", blocker: "Cannot write a field update for a missing issue." })
  }

  const before = issueFieldValue(state, issue, change.fieldId)
  const after = draftFieldValue(state, change.fieldId, change.value)
  const title = `${change.issueKey} ${change.label}`
  const detail = `${before || "empty"} -> ${after || "empty"}`

  if (change.fieldId === "statusId") {
    return {
      id: change.id,
      status: "planned",
      issueKey: change.issueKey,
      title,
      detail,
      method: "POST",
      endpoint: `/rest/api/3/issue/${change.issueKey}/transitions`,
      payloadPreview: `transition target status = ${change.value}`,
      operation: "transition",
      transitionStatusId: change.value,
    }
  }
  if (change.fieldId === "assignee" || change.fieldId === "reporter") {
    const accountId = state.userDraftAccountIds[change.issueKey]?.[change.fieldId]
    if (!accountId) return blockedPlan({ id: change.id, issueKey: change.issueKey, title, detail, method: "PUT", endpoint: `/rest/api/3/issue/${change.issueKey}`, blocker: "Select a Jira project member from the user picker." })
    return {
      id: change.id,
      status: "planned",
      issueKey: change.issueKey,
      title,
      detail,
      method: "PUT",
      endpoint: `/rest/api/3/issue/${change.issueKey}`,
      payloadPreview: `fields.${change.fieldId}.accountId = ${accountId}`,
      operation: "field-update",
      fieldId: change.fieldId,
      fieldValue: change.value,
      fieldAccountId: accountId,
    }
  }
  if (change.fieldId === "sprintId") {
    const sprint = state.sprints.find((candidate) => candidate.id === change.value || candidate.name === change.value)
    if (change.value && !sprint) return blockedPlan({ id: change.id, issueKey: change.issueKey, title, detail, method: "POST", endpoint: "/rest/agile/1.0/sprint/{sprintId}/issue", blocker: "Choose a loaded sprint or clear the field to move the issue to backlog." })
    return {
      id: change.id,
      status: "planned",
      issueKey: change.issueKey,
      title,
      detail,
      method: "POST",
      endpoint: sprint ? `/rest/agile/1.0/sprint/${sprint.id}/issue` : "/rest/agile/1.0/backlog/issue",
      payloadPreview: `issues = [${change.issueKey}]`,
      operation: "sprint-move",
      sprintId: sprint?.id,
    }
  }
  if (change.fieldId === "storyPoints" || change.fieldId === "estimate") {
    if (change.value.trim() && !Number.isFinite(Number(change.value))) return blockedPlan({ id: change.id, issueKey: change.issueKey, title, detail, method: "PUT", endpoint: `/rest/api/3/issue/${change.issueKey}`, blocker: `${change.label} must be a number.` })
    return {
      id: change.id,
      status: "planned",
      issueKey: change.issueKey,
      title,
      detail,
      method: "PUT",
      endpoint: `/rest/api/3/issue/${change.issueKey}`,
      payloadPreview: `${change.fieldId} = ${change.value || "empty"}`,
      operation: "discovered-field",
      discoveredField: change.fieldId,
      fieldValue: change.value,
    }
  }
  if (["epic", "feature", "space", "blocked"].includes(change.fieldId)) {
    return blockedPlan({ id: change.id, issueKey: change.issueKey, title, detail, method: "PUT", endpoint: `/rest/api/3/issue/${change.issueKey}`, blocker: "This field needs Jira custom field mapping before it can be written safely." })
  }
  if (change.fieldId === "type") {
    return {
      id: change.id,
      status: "planned",
      issueKey: change.issueKey,
      title,
      detail,
      method: "PUT",
      endpoint: `/rest/api/3/issue/${change.issueKey}`,
      payloadPreview: `issuetype = ${change.value}`,
      operation: "issue-type",
      issueType: change.value,
    }
  }
  if (change.fieldId === "links") {
    return blockedPlan({ id: change.id, issueKey: change.issueKey, title, detail, method: "POST", endpoint: "/rest/api/3/issueLink", blocker: "Issue link writes need link type and direction modeling." })
  }

  const jiraField = jiraFieldForEditable(change.fieldId)
  if (!jiraField) {
    return blockedPlan({ id: change.id, issueKey: change.issueKey, title, detail, blocker: "No Jira field mapping exists for this staged change." })
  }

  return {
    id: change.id,
    status: "planned",
    issueKey: change.issueKey,
    title,
    detail,
    method: "PUT",
    endpoint: `/rest/api/3/issue/${change.issueKey}`,
    payloadPreview: `fields.${jiraField} = ${payloadValuePreview(change.fieldId, change.value)}`,
    operation: "field-update",
    fieldId: change.fieldId,
    fieldValue: change.value,
  }
}

function blockedPlan(item: Omit<JiraWritePlanItem, "status">): JiraWritePlanItem {
  return { ...item, status: "blocked" }
}

function jiraFieldForEditable(fieldId: IssueEditableField) {
  switch (fieldId) {
    case "title":
      return "summary"
    case "priority":
      return "priority.name"
    case "parentKey":
      return "parent.key"
    case "dueDate":
      return "duedate"
    case "labels":
      return "labels"
    case "components":
      return "components[].name"
    case "fixVersions":
      return "fixVersions[].name"
    case "affectsVersions":
      return "versions[].name"
    case "description":
      return "description"
    default:
      return undefined
  }
}

function payloadValuePreview(fieldId: IssueEditableField, value: string) {
  if (["labels", "components", "fixVersions", "affectsVersions"].includes(fieldId)) return `[${splitList(value).join(", ")}]`
  return value || "empty"
}

function issueFieldValue(state: AppState, issue: IssueSummary, fieldId: IssueEditableField) {
  switch (fieldId) {
    case "title":
      return issue.title
    case "type":
      return issue.type
    case "statusId":
      return statusLabel(state, issue.statusId)
    case "priority":
      return issue.priority
    case "assignee":
      return issue.assignee
    case "reporter":
      return issue.reporter
    case "sprintId":
      return sprintLabel(state, issue.sprintId)
    case "parentKey":
      return issue.parentKey ?? ""
    case "storyPoints":
      return String(issue.storyPoints ?? "")
    case "estimate":
      return String(issue.estimate ?? "")
    case "dueDate":
      return issue.dueDate ?? ""
    case "epic":
      return issue.epic ?? ""
    case "feature":
      return issue.feature ?? ""
    case "space":
      return issue.space ?? ""
    case "labels":
      return issue.labels.join(", ")
    case "components":
      return issue.components.join(", ")
    case "fixVersions":
      return (issue.fixVersions ?? []).join(", ")
    case "affectsVersions":
      return (issue.affectsVersions ?? []).join(", ")
    case "links":
      return issue.links.join(", ")
    case "blocked":
      return issue.blocked ? "yes" : "no"
    case "description":
      return issue.description.replace(/\s+/g, " ").slice(0, 48)
  }
}

function draftFieldValue(state: AppState, fieldId: IssueEditableField, value: string) {
  if (fieldId === "statusId") return statusLabel(state, value)
  if (fieldId === "sprintId") return sprintLabel(state, value)
  if (fieldId === "description") return value.replace(/\s+/g, " ").slice(0, 48)
  return value
}

function statusLabel(state: AppState, statusId: string) {
  return configuredStatuses(state).find((status) => status.id === statusId)?.name ?? statusId
}

function sprintLabel(state: AppState, sprintId: string | undefined) {
  return state.sprints.find((sprint) => sprint.id === sprintId)?.name ?? "Backlog"
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean)
}

function commentPreview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 80)
}
