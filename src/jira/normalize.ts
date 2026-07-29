import type { IssueComment, IssuePriority, IssueSummary, SprintSummary, StatusCategory, StatusColumn, StatusDefinition } from "../state/app-state"
import { statusColorForStatus } from "../state/metadata-colors"
import type { JiraBoardConfiguration, JiraComment, JiraField, JiraIssue, JiraProjectStatusesByIssueType, JiraSprint } from "./client"
import { adfToRichText } from "./adf"

type JiraIssueFields = NonNullable<JiraIssue["fields"]>

export type JiraIssueFieldIds = {
  sprint?: string
  storyPoints?: string
  storyPointEstimate?: string
  rank?: string
}

export const fallbackJiraIssueFieldIds: Required<JiraIssueFieldIds> = {
  sprint: "customfield_10020",
  storyPoints: "customfield_10036",
  storyPointEstimate: "customfield_10016",
  rank: "customfield_10019",
}

export type BoardMetadata = {
  statuses: StatusDefinition[]
  columns: StatusColumn[]
}

export type JiraStatusLookup = Map<string, { name: string; category?: StatusCategory; colorName?: string }>

export function normalizeProjectStatuses(issueTypes: JiraProjectStatusesByIssueType[]): JiraStatusLookup {
  const statuses: JiraStatusLookup = new Map()
  for (const issueType of issueTypes) {
    for (const status of issueType.statuses ?? []) {
      if (!status.id || !status.name || statuses.has(status.id)) continue
      statuses.set(status.id, { name: status.name, category: statusCategoryForJiraValue(status.statusCategory?.key ?? status.statusCategory?.name), colorName: status.statusCategory?.colorName })
    }
  }
  return statuses
}

export function normalizeBoardConfiguration(config: JiraBoardConfiguration, statusLookup: JiraStatusLookup = new Map()): BoardMetadata {
  const columns = config.columnConfig?.columns ?? []
  const statuses: StatusDefinition[] = []
  const statusColumns: StatusColumn[] = []

  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex]
    if (!column) continue
    const columnName = column.name?.trim() || `Column ${columnIndex + 1}`
    const category = statusCategoryForColumn(columnName, columnIndex, columns.length)
    const statusIds = (column.statuses ?? []).flatMap((status) => status.id ? [status.id] : [])
    const columnColor = statusColorForStatus(columnName, category)

    statusColumns.push({ id: columnId(columnName, columnIndex), name: columnName, issueKeys: [], statusIds, category, color: columnColor })

    for (let statusIndex = 0; statusIndex < statusIds.length; statusIndex += 1) {
      const statusId = statusIds[statusIndex]!
      const knownStatus = statusLookup.get(statusId)
      const statusName = knownStatus?.name ?? statusNameForColumn(columnName, statusIndex, statusIds.length)
      statuses.push({
        id: statusId,
        name: statusName,
        category,
        color: statusColorForStatus(statusName, category, columnName, knownStatus?.colorName),
      })
    }
  }

  return { statuses, columns: statusColumns }
}

export function normalizeBoardSprints(sprints: JiraSprint[]): SprintSummary[] {
  return sprints.flatMap((sprint) => {
    if (!sprint.id || !sprint.name || !isSprintState(sprint.state)) return []
    return [{ id: String(sprint.id), name: sprint.name, goal: sprint.goal ?? "", state: sprint.state }]
  })
}

export function discoverJiraIssueFieldIds(fields: JiraField[]): JiraIssueFieldIds {
  return {
    sprint: fieldId(fields, isSprintField) ?? knownFieldId(fields, fallbackJiraIssueFieldIds.sprint),
    storyPoints: fieldId(fields, isStoryPointsField) ?? knownFieldId(fields, fallbackJiraIssueFieldIds.storyPoints),
    storyPointEstimate: fieldId(fields, isStoryPointEstimateField) ?? knownFieldId(fields, fallbackJiraIssueFieldIds.storyPointEstimate),
    rank: fieldId(fields, isRankField) ?? knownFieldId(fields, fallbackJiraIssueFieldIds.rank),
  }
}

export function issueCustomFieldIds(fieldIds: JiraIssueFieldIds): string[] {
  return [fieldIds.sprint, fieldIds.storyPoints, fieldIds.storyPointEstimate, fieldIds.rank].filter((fieldId): fieldId is string => !!fieldId)
}

export function normalizeSprintIssues(issues: JiraIssue[], sprintId: string, statuses: StatusDefinition[], fieldIds: JiraIssueFieldIds = {}): IssueSummary[] {
  return normalizeJiraIssues(issues, statuses, { fallbackSprintId: sprintId, fieldIds })
}

export function normalizeJiraIssues(issues: JiraIssue[], statuses: StatusDefinition[], options: { fallbackSprintId?: string; fieldIds?: JiraIssueFieldIds } = {}): IssueSummary[] {
  const fieldIds = options.fieldIds ?? {}
  return issues.flatMap((issue) => {
    if (!issue.key) return []
    const fields = issue.fields ?? {}
    const statusId = fields.status?.id ?? statuses[0]?.id ?? "unknown"
    const statusCategory = statuses.find((status) => status.id === statusId)?.category
    const labels = stringArray(fields.labels)
    const storyPointValue = numberField(fields, fieldIds.storyPoints)
    const estimateValue = numberField(fields, fieldIds.storyPointEstimate)
    const description = adfToRichText(fields.description)
    return [{
      key: issue.key,
      title: fields.summary?.trim() || issue.key,
      type: fields.issuetype?.name ?? "Task",
      priority: normalizePriority(fields.priority?.name),
      statusId,
      assignee: fields.assignee?.displayName ?? "Unassigned",
      reporter: fields.reporter?.displayName ?? "Unknown",
      sprintId: issueSprintId(fields, fieldIds.sprint) ?? options.fallbackSprintId,
      parentKey: fields.parent?.key,
      storyPoints: storyPointValue ?? estimateValue,
      estimate: estimateValue,
      dueDate: fields.duedate,
      createdAt: fields.created,
      updatedAt: fields.updated,
      resolution: fields.resolution?.name,
      fixVersions: names(fields.fixVersions),
      affectsVersions: names(fields.versions),
      labels,
      components: names(fields.components),
      blocked: statusCategory === "blocked" || labels.some((label) => label.toLowerCase().includes("block")),
      staleDays: 0,
      description: description.markdown,
      descriptionWriteBlockedReason: description.writeBlockedReason,
      comments: [],
      links: linkedIssueKeys(fields.issuelinks, fields.subtasks),
      rank: stringField(fields, fieldIds.rank),
    }]
  })
}

export function normalizeJiraComments(comments: JiraComment[]): IssueComment[] {
  return comments.flatMap((comment) => {
    if (!comment.id) return []
    const body = adfToRichText(comment.body)
    return [{
      id: comment.id,
      author: comment.author?.displayName ?? "Unknown",
      body: body.markdown,
      writeBlockedReason: body.writeBlockedReason,
      age: jiraDateLabel(comment.updated ?? comment.created),
    }]
  })
}

export function mergeIssueDetail(existing: IssueSummary | undefined, detail: IssueSummary, comments: IssueComment[]): IssueSummary {
  return {
    ...existing,
    ...detail,
    comments,
    staleDays: existing?.staleDays ?? detail.staleDays,
    isDraft: existing?.isDraft ?? detail.isDraft,
  }
}

function fieldId(fields: JiraField[], matches: (field: JiraField) => boolean) {
  return fields.find((field) => field.id && matches(field))?.id
}

function knownFieldId(fields: JiraField[], fieldId: string) {
  return fields.some((field) => field.id === fieldId) ? fieldId : undefined
}

function isSprintField(field: JiraField) {
  const normalized = normalizedFieldName(field)
  return normalized === "sprint" || (field.schema?.custom?.toLowerCase().includes("sprint") ?? false)
}

function isStoryPointsField(field: JiraField) {
  const normalized = normalizedFieldName(field)
  return normalized === "story points" || normalized === "story point" || normalized === "storypoints"
}

function isStoryPointEstimateField(field: JiraField) {
  const normalized = normalizedFieldName(field)
  return normalized === "story point estimate" || normalized === "story points estimate" || normalized === "story estimate"
}

function isRankField(field: JiraField) {
  const normalized = normalizedFieldName(field)
  return normalized === "rank" || (field.schema?.custom?.toLowerCase().includes("rank") ?? false)
}

function normalizedFieldName(field: JiraField) {
  return field.name?.trim().toLowerCase().replace(/\s+/g, " ") ?? ""
}

function issueSprintId(fields: JiraIssueFields, fieldId: string | undefined) {
  const value = customField(fields, fieldId)
  if (Array.isArray(value)) {
    const sprints = value.flatMap(jiraSprintFieldValue)
    return [...sprints].reverse().find((sprint) => sprint.state === "active" || sprint.state === "future")?.id
  }
  const sprint = jiraSprintFieldValue(value)[0]
  return sprint?.state === "active" || sprint?.state === "future" ? sprint.id : undefined
}

function jiraSprintFieldValue(value: unknown): Array<{ id: string; state?: string }> {
  if (isRecord(value) && (typeof value.id === "number" || typeof value.id === "string")) {
    return [{ id: String(value.id), state: typeof value.state === "string" ? value.state : undefined }]
  }
  if (typeof value === "string") {
    const id = value.match(/\bid=([^,\]]+)/)?.[1]
    return id ? [{ id }] : []
  }
  return []
}

function numberField(fields: JiraIssueFields, fieldId: string | undefined) {
  const value = customField(fields, fieldId)
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function stringField(fields: JiraIssueFields, fieldId: string | undefined) {
  const value = customField(fields, fieldId)
  return typeof value === "string" && value.trim() ? value : undefined
}

function customField(fields: JiraIssueFields, fieldId: string | undefined) {
  return fieldId ? fields[fieldId] : undefined
}

function statusNameForColumn(columnName: string, index: number, columnStatusCount: number) {
  return columnStatusCount > 1 ? `${columnName} ${index + 1}` : columnName
}

function statusCategoryForJiraValue(value: string | undefined): StatusCategory | undefined {
  const normalized = value?.toLowerCase() ?? ""
  if (!normalized) return
  if (normalized.includes("todo") || normalized.includes("to do") || normalized === "new") return "todo"
  if (normalized.includes("done") || normalized.includes("complete")) return "done"
  if (normalized.includes("progress") || normalized.includes("indeterminate")) return "in-progress"
  return
}

function columnId(columnName: string, index: number) {
  const slug = columnName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return slug || `column-${index + 1}`
}

function statusCategoryForColumn(name: string, index: number, count: number): StatusCategory {
  const normalized = name.toLowerCase()
  if (normalized.includes("block")) return "blocked"
  if (normalized.includes("review") || normalized.includes("qa") || normalized.includes("test")) return "review"
  if (normalized.includes("progress") || normalized.includes("doing") || normalized.includes("develop")) return "in-progress"
  if (normalized.includes("done") || normalized.includes("closed") || normalized.includes("resolved")) return "done"
  if (index === count - 1 && count > 1) return "done"
  if (index > 0) return "in-progress"
  return "todo"
}

function isSprintState(value: string | undefined): value is SprintSummary["state"] {
  return value === "active" || value === "future" || value === "closed"
}

function normalizePriority(name: string | undefined): IssuePriority {
  const normalized = name?.toLowerCase() ?? ""
  if (normalized.includes("critical") || normalized.includes("highest")) return "Critical"
  if (normalized.includes("high")) return "High"
  if (normalized.includes("low") || normalized.includes("lowest")) return "Low"
  return "Medium"
}

function names(values: Array<{ name?: string }> | undefined) {
  return (values ?? []).flatMap((value) => value.name ? [value.name] : [])
}

function stringArray(values: string[] | undefined) {
  return (values ?? []).filter((value): value is string => typeof value === "string")
}

function linkedIssueKeys(links: JiraIssueFields["issuelinks"], subtasks: JiraIssueFields["subtasks"]) {
  return [
    ...(links ?? []).flatMap((link) => [link.outwardIssue?.key, link.inwardIssue?.key].filter((key): key is string => !!key)),
    ...(subtasks ?? []).flatMap((subtask) => subtask.key ? [subtask.key] : []),
  ]
}

function jiraDateLabel(value: string | undefined) {
  if (!value) return "unknown"
  return value.slice(0, 10) || value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
