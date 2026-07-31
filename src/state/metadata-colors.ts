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

export function parentColorForKey(key: string) {
  let hash = 2_166_136_261
  for (const character of key.toUpperCase()) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  const value = hash >>> 0
  const hue = value % 360
  const saturation = 68 + ((value >>> 9) % 17)
  const lightness = 58 + ((value >>> 17) % 11)
  return hslToHex(hue, saturation, lightness)
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const segment = hue / 60
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1))
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0]
    : segment < 2 ? [secondary, chroma, 0]
      : segment < 3 ? [0, chroma, secondary]
        : segment < 4 ? [0, secondary, chroma]
          : segment < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary]
  const match = l - chroma / 2
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`
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
