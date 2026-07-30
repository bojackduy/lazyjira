import type { IssuePriority, StatusCategory } from "./app-state"

export const statusCategoryColors: Record<StatusCategory, string> = {
  todo: "#94A3B8",
  "in-progress": "#38BDF8",
  review: "#A78BFA",
  blocked: "#EF4444",
  done: "#22C55E",
}

const jiraStatusCategoryColors: Record<string, string> = {
  "blue-gray": statusCategoryColors.todo,
  yellow: statusCategoryColors["in-progress"],
  green: statusCategoryColors.done,
}

export const defaultIssueTypeColor = "#58A6FF"

export const issueTypeColors = {
  epic: "#A371F7",
  feature: "#39C5CF",
  story: "#3FB950",
  task: "#58A6FF",
  subtask: "#8B949E",
  bug: "#F85149",
}

export function issueTypeColorForName(name: string) {
  const normalized = name.toLowerCase()
  if (normalized.includes("epic")) return issueTypeColors.epic
  if (normalized.includes("feature")) return issueTypeColors.feature
  if (normalized.includes("story")) return issueTypeColors.story
  if (normalized.includes("subtask") || normalized.includes("sub-task")) return issueTypeColors.subtask
  if (normalized.includes("bug")) return issueTypeColors.bug
  return issueTypeColors.task
}

const statusIntentColors = {
  ready: "#22D3EE",
  review: "#A78BFA",
  qa: "#F472B6",
  planned: "#FBBF24",
  reopened: "#F59E0B",
  rejected: "#F97316",
  progress: "#38BDF8",
  done: "#22C55E",
  blocked: "#EF4444",
}

export const priorityColors: Record<IssuePriority, string> = {
  Critical: "#F85149",
  High: "#DB6D28",
  Medium: "#D29922",
  Low: "#3FB950",
}

export function statusColorForCategory(category: StatusCategory) {
  return statusCategoryColors[category]
}

export function statusColorForStatus(name: string, category: StatusCategory, context = "", jiraColorName?: string) {
  const normalizedName = name.toLowerCase()
  const normalizedContext = context.toLowerCase()
  const normalized = `${normalizedName} ${normalizedContext}`
  const directColor = colorForStatusText(normalizedName)
  if (directColor) return directColor
  const contextColor = colorForStatusText(normalizedContext)
  if (contextColor) return contextColor
  if (/(block|impediment|hold)/.test(normalized)) return statusIntentColors.blocked
  return statusColorForJiraColorName(jiraColorName, category)
}

function colorForStatusText(value: string) {
  if (/(block|impediment|hold)/.test(value)) return statusIntentColors.blocked
  if (/(reject|declin|cancel|won't|wont)/.test(value)) return statusIntentColors.rejected
  if (/(reopen|returned)/.test(value)) return statusIntentColors.reopened
  if (/(done|fixed|resolved|closed|released|complete)/.test(value)) return statusIntentColors.done
  if (/(qa|test|uat|verify|verified)/.test(value)) return statusIntentColors.qa
  if (/(review|approval|approve)/.test(value)) return statusIntentColors.review
  if (/(plan|selected)/.test(value)) return statusIntentColors.planned
  if (/(ready|prepared)/.test(value)) return statusIntentColors.ready
  if (/(progress|doing|dev|develop|implement)/.test(value)) return statusIntentColors.progress
  return undefined
}

function statusColorForJiraColorName(colorName: string | undefined, fallbackCategory: StatusCategory) {
  const normalized = colorName?.toLowerCase()
  return (normalized && jiraStatusCategoryColors[normalized]) || statusColorForCategory(fallbackCategory)
}
