import type { IssuePriority, StatusCategory } from "./app-state"

export const statusCategoryColors: Record<StatusCategory, string> = {
  todo: "#94A3B8",
  "in-progress": "#38BDF8",
  review: "#A78BFA",
  blocked: "#EF4444",
  done: "#22C55E",
}

const jiraStatusCategoryColors: Record<string, string> = {
  "blue-gray": "#6B778C",
  yellow: "#FFAB00",
  green: "#36B37E",
}

const jiraIssueColors: Record<string, string> = {
  dark_grey: "#42526E",
  grey: "#97A0AF",
  dark_blue: "#0747A6",
  blue: "#4C9AFF",
  teal: "#00B8D9",
  green: "#36B37E",
  dark_yellow: "#FF991F",
  yellow: "#FFC400",
  dark_orange: "#DE350B",
  orange: "#FF8B00",
  dark_purple: "#403294",
  purple: "#6554C0",
  dark_red: "#BF2600",
  red: "#FF5630",
  "ghx-label-1": "#42526E",
  "ghx-label-2": "#FF991F",
  "ghx-label-3": "#FFC400",
  "ghx-label-4": "#0747A6",
  "ghx-label-5": "#4C9AFF",
  "ghx-label-6": "#36B37E",
  "ghx-label-7": "#6554C0",
  "ghx-label-8": "#403294",
  "ghx-label-9": "#FF8B00",
  "ghx-label-10": "#FF5630",
  "ghx-label-11": "#00B8D9",
  "ghx-label-12": "#97A0AF",
  "ghx-label-13": "#BF2600",
  "ghx-label-14": "#DE350B",
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
  void name
  void context
  return statusColorForJiraColorName(jiraColorName, category)
}

export function jiraMetadataColor(value: unknown) {
  if (typeof value !== "string") return undefined
  const normalized = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(normalized)) return normalized.toUpperCase()
  return jiraIssueColors[normalized]
}

function statusColorForJiraColorName(colorName: string | undefined, fallbackCategory: StatusCategory) {
  const normalized = colorName?.toLowerCase()
  return (normalized && jiraStatusCategoryColors[normalized]) || statusColorForCategory(fallbackCategory)
}
