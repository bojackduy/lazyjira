import type { IssuePriority, StatusCategory } from "./app-state"

export const statusCategoryColors: Record<StatusCategory, string> = {
  todo: "#94A3B8",
  "in-progress": "#60A5FA",
  review: "#C084FC",
  blocked: "#FB7185",
  done: "#34D399",
}

export const defaultIssueTypeColor = "#60A5FA"

export const issueTypeColors = {
  epic: "#C084FC",
  feature: "#22D3EE",
  story: "#34D399",
  task: "#60A5FA",
  subtask: "#A1A1AA",
  bug: "#FB7185",
}

export const priorityColors: Record<IssuePriority, string> = {
  Critical: "#F43F5E",
  High: "#FB923C",
  Medium: "#FBBF24",
  Low: "#34D399",
}

export function statusColorForCategory(category: StatusCategory) {
  return statusCategoryColors[category]
}
