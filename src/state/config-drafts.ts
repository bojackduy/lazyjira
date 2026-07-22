import type { AppState, ConfigDraft, ConfigSectionId, IssueTypeDefinition, StatusDefinition } from "./app-state"

export const configSectionIds: ConfigSectionId[] = ["columns", "statuses", "issue-types", "priorities", "fields", "quick-filters"]

export function configSectionIdAt(index: number): ConfigSectionId {
  return configSectionIds[Math.max(0, Math.min(index, configSectionIds.length - 1))] ?? "columns"
}

export function writableConfigSection(sectionId: ConfigSectionId) {
  return sectionId === "columns" || sectionId === "statuses" || sectionId === "issue-types"
}

export function colorableConfigSection(sectionId: ConfigSectionId) {
  return sectionId === "columns" || sectionId === "statuses" || sectionId === "issue-types"
}

export function configuredStatuses(state: AppState): StatusDefinition[] {
  let statuses = state.statuses.map((status) => ({ ...status }))
  for (const draft of state.configDrafts) {
    if (draft.sectionId !== "columns" && draft.sectionId !== "statuses") continue
    if (draft.action === "add" && draft.name) {
      const id = uniqueId(slug(draft.name), statuses.map((status) => status.id))
      statuses.push({ id, name: draft.name, category: draft.category ?? "todo", color: draft.color ?? "#64748B" })
      continue
    }
    if (!draft.targetId) continue
    if (draft.action === "remove") statuses = statuses.filter((status) => status.id !== draft.targetId)
    if (draft.action === "rename" && draft.name) {
      const name = draft.name
      statuses = statuses.map((status) => status.id === draft.targetId ? { ...status, name } : status)
    }
    if (draft.action === "color" && draft.color) {
      const color = draft.color
      statuses = statuses.map((status) => status.id === draft.targetId ? { ...status, color } : status)
    }
  }
  return statuses
}

export function configuredIssueTypes(state: AppState): IssueTypeDefinition[] {
  let issueTypes = state.issueTypes.map((issueType) => ({ ...issueType }))
  for (const draft of state.configDrafts) {
    if (draft.sectionId !== "issue-types") continue
    if (draft.action === "add" && draft.name) {
      const id = uniqueId(draft.name, issueTypes.map((issueType) => issueType.id))
      issueTypes.push({ id, name: draft.name, color: draft.color ?? "#3B82F6" })
      continue
    }
    if (!draft.targetId) continue
    if (draft.action === "remove") issueTypes = issueTypes.filter((issueType) => issueType.id !== draft.targetId)
    if (draft.action === "rename" && draft.name) {
      const name = draft.name
      issueTypes = issueTypes.map((issueType) => issueType.id === draft.targetId ? { ...issueType, name } : issueType)
    }
    if (draft.action === "color" && draft.color) {
      const color = draft.color
      issueTypes = issueTypes.map((issueType) => issueType.id === draft.targetId ? { ...issueType, color } : issueType)
    }
  }
  return issueTypes
}

export function configRowIds(state: AppState, sectionId: ConfigSectionId): string[] {
  switch (sectionId) {
    case "columns":
    case "statuses":
      return configuredStatuses(state).map((status) => status.id)
    case "issue-types":
      return configuredIssueTypes(state).map((issueType) => issueType.id)
    case "priorities":
      return ["Critical", "High", "Medium", "Low"]
    case "quick-filters":
      return state.quickFilters.map((filter) => filter.id)
    case "fields":
      return []
  }
}

export function selectedConfigTargetId(state: AppState) {
  const sectionId = configSectionIdAt(state.configSelectedSectionIndex)
  return configRowIds(state, sectionId)[state.configSelectedRowIndex]
}

export function configDraftSummary(draft: ConfigDraft) {
  const section = draft.sectionId === "issue-types" ? "Issue Type" : draft.sectionId === "columns" ? "Column" : "Status"
  if (draft.action === "add") return `+ ${section} ${draft.name ?? "Untitled"}`
  if (draft.action === "remove") return `- ${section} ${draft.targetId ?? "unknown"}`
  if (draft.action === "rename") return `~ ${section} ${draft.targetId ?? "unknown"} -> ${draft.name ?? ""}`
  return `~ ${section} ${draft.targetId ?? "unknown"} color -> ${draft.color ?? ""}`
}

export function normalizedColor(value: string) {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed
  return undefined
}

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom"
}

function uniqueId(base: string, existingIds: string[]) {
  let id = base
  let suffix = 2
  const used = new Set(existingIds)
  while (used.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  return id
}
