import type { AppState, IssueSummary } from "./app-state"
import { configuredIssueTypes, configuredStatuses } from "./config-drafts"

type SearchToken =
  | { kind: "text"; value: string; negated: boolean }
  | { kind: "field"; field: string; value: string; negated: boolean }

const knownFields = new Set([
  "key",
  "assignee",
  "reporter",
  "status",
  "type",
  "priority",
  "sprint",
  "epic",
  "feature",
  "space",
  "label",
  "labels",
  "component",
  "components",
  "is",
  "has",
  "no",
])

export function effectiveIssueSearchQuery(state: AppState) {
  return state.searchQuery
}

export function matchesIssueSearch(state: AppState, issue: IssueSummary) {
  const tokens = parseIssueSearchQuery(effectiveIssueSearchQuery(state))
  return tokens.every((token) => {
    const matched = token.kind === "text" ? matchesTextToken(state, issue, token.value) : matchesFieldToken(state, issue, token.field, token.value)
    return token.negated ? !matched : matched
  })
}

export function parseIssueSearchQuery(query: string): SearchToken[] {
  const tokens: SearchToken[] = []
  for (const rawPart of splitQuery(query)) {
    let part = rawPart.trim()
    if (!part) continue
    const negated = part.startsWith("-")
    if (negated) part = part.slice(1)
    const separator = part.indexOf(":")
    if (separator > 0) {
      const field = normalize(part.slice(0, separator))
      const value = part.slice(separator + 1).trim()
      if (knownFields.has(field) && value) {
        tokens.push({ kind: "field", field, value, negated })
        continue
      }
    }
    tokens.push({ kind: "text", value: part, negated })
  }
  return tokens
}

function splitQuery(query: string) {
  const parts: string[] = []
  let current = ""
  let quote: string | undefined
  for (const char of query.trim()) {
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? undefined : char
      continue
    }
    if (/\s/.test(char) && !quote) {
      if (current) parts.push(current)
      current = ""
      continue
    }
    current += char
  }
  if (current) parts.push(current)
  return parts
}

function matchesTextToken(state: AppState, issue: IssueSummary, value: string) {
  const needle = normalize(value)
  if (!needle) return true
  return issueSearchText(state, issue).some((candidate) => includesNormalized(candidate, needle))
}

function matchesFieldToken(state: AppState, issue: IssueSummary, field: string, value: string) {
  const needle = normalize(value)
  if (!needle) return true
  switch (field) {
    case "key":
      return includesNormalized(issue.key, needle)
    case "assignee":
      return includesNormalized(issue.assignee, needle)
    case "reporter":
      return includesNormalized(issue.reporter, needle)
    case "status":
      return issueStatusValues(state, issue).some((candidate) => includesNormalized(candidate, needle))
    case "type":
      return issueTypeValues(state, issue).some((candidate) => includesNormalized(candidate, needle))
    case "priority":
      return includesNormalized(issue.priority, needle)
    case "sprint":
      return issueSprintValues(state, issue).some((candidate) => includesNormalized(candidate, needle))
    case "epic":
      return includesNormalized(issue.epic ?? "", needle)
    case "feature":
      return includesNormalized(issue.feature ?? "", needle)
    case "space":
      return includesNormalized(issue.space ?? "", needle)
    case "label":
    case "labels":
      return issue.labels.some((label) => includesNormalized(label, needle))
    case "component":
    case "components":
      return issue.components.some((component) => includesNormalized(component, needle))
    case "is":
      return matchesIsToken(state, issue, needle)
    case "has":
      return matchesHasToken(state, issue, needle)
    case "no":
      return matchesNoToken(issue, needle)
  }
  return false
}

function issueSearchText(state: AppState, issue: IssueSummary) {
  return [
    issue.key,
    issue.title,
    issue.description,
    issue.assignee,
    issue.reporter,
    issue.priority,
    issue.epic,
    issue.feature,
    issue.space,
    ...issue.labels,
    ...issue.components,
    ...(issue.fixVersions ?? []),
    ...(issue.affectsVersions ?? []),
    ...issue.links,
    ...issueStatusValues(state, issue),
    ...issueTypeValues(state, issue),
    ...issueSprintValues(state, issue),
  ].filter(isString)
}

function issueStatusValues(state: AppState, issue: IssueSummary) {
  const status = configuredStatuses(state).find((candidate) => candidate.id === issue.statusId)
  return [issue.statusId, status?.name, status?.category].filter(isString)
}

function issueTypeValues(state: AppState, issue: IssueSummary) {
  const issueType = configuredIssueTypes(state).find((candidate) => candidate.id === issue.type)
  return [issue.type, issueType?.name, issue.typeName].filter(isString)
}

function issueSprintValues(state: AppState, issue: IssueSummary) {
  const sprint = state.sprints.find((candidate) => candidate.id === issue.sprintId)
  return [issue.sprintId, sprint?.name, issue.sprintId ? undefined : "backlog", issue.sprintId ? undefined : "no sprint"].filter(isString)
}

function matchesIsToken(state: AppState, issue: IssueSummary, value: string) {
  if (value === "blocked") return issue.blocked || issue.statusId === "blocked"
  if (value === "stale") return issue.staleDays >= 7
  if (value === "unassigned") return issue.assignee === "Unassigned"
  if (value === "draft") return !!issue.isDraft
  if (value === "done") return configuredStatuses(state).find((status) => status.id === issue.statusId)?.category === "done"
  return false
}

function matchesHasToken(state: AppState, issue: IssueSummary, value: string) {
  if (value === "staged") return !!state.issueDrafts[issue.key] || state.issueDeletes.includes(issue.key) || !!issue.isDraft
  return false
}

function matchesNoToken(issue: IssueSummary, value: string) {
  if (value === "estimate") return !issue.storyPoints && !issue.estimate
  if (value === "sprint") return !issue.sprintId
  if (value === "assignee") return !issue.assignee || issue.assignee === "Unassigned"
  return false
}

function includesNormalized(value: string, needle: string) {
  return normalize(value).includes(needle)
}

function isString(value: string | undefined): value is string {
  return !!value
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[_\s]+/g, "-").trim()
}
