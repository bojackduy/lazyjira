import type { IssuePriority, IssueSummary, SprintSummary, StatusCategory, StatusColumn, StatusDefinition } from "../state/app-state"
import { statusColorForStatus } from "../state/metadata-colors"
import type { JiraBoardConfiguration, JiraIssue, JiraProjectStatusesByIssueType, JiraSprint } from "./client"

type JiraIssueFields = NonNullable<JiraIssue["fields"]>

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

export function normalizeSprintIssues(issues: JiraIssue[], sprintId: string, statuses: StatusDefinition[]): IssueSummary[] {
  return issues.flatMap((issue) => {
    if (!issue.key) return []
    const fields = issue.fields ?? {}
    const statusId = fields.status?.id ?? statuses[0]?.id ?? "unknown"
    const statusCategory = statuses.find((status) => status.id === statusId)?.category
    const labels = stringArray(fields.labels)
    return [{
      key: issue.key,
      title: fields.summary?.trim() || issue.key,
      type: fields.issuetype?.name ?? "Task",
      priority: normalizePriority(fields.priority?.name),
      statusId,
      assignee: fields.assignee?.displayName ?? "Unassigned",
      reporter: fields.reporter?.displayName ?? "Unknown",
      sprintId,
      parentKey: fields.parent?.key,
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
      description: jiraDescriptionText(fields.description),
      comments: [],
      links: linkedIssueKeys(fields.issuelinks, fields.subtasks),
    }]
  })
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

function jiraDescriptionText(value: unknown) {
  if (typeof value === "string") return value
  const text = adfText(value).trim()
  return text || ""
}

function adfText(value: unknown): string {
  if (typeof value === "string") return value
  if (!value || typeof value !== "object") return ""
  if (Array.isArray(value)) return value.map(adfText).filter(Boolean).join(" ")
  const record = value as Record<string, unknown>
  const ownText = typeof record.text === "string" ? record.text : ""
  const childText = adfText(record.content)
  return [ownText, childText].filter(Boolean).join(" ")
}
