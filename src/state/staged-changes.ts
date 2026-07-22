import type { AppState, ConfigDraft, IssueEditableField } from "./app-state"
import { configDraftSummary } from "./config-drafts"
import { issueFields } from "./issue-fields"

export type StagedChange =
  | { id: string; kind: "edit"; issueKey: string; fieldId: IssueEditableField; label: string; value: string }
  | { id: string; kind: "delete"; issueKey: string; label: string }
  | { id: string; kind: "config"; draftId: string; label: string; value: string }

export function stagedChanges(state: AppState): StagedChange[] {
  const changes: StagedChange[] = []
  for (const [issueKey, draft] of Object.entries(state.issueDrafts)) {
    for (const [fieldId, value] of Object.entries(draft) as [IssueEditableField, string][]) {
      changes.push({ id: stagedEditId(issueKey, fieldId), kind: "edit", issueKey, fieldId, label: stagedFieldLabel(fieldId), value })
    }
  }
  for (const issueKey of state.issueDeletes) {
    changes.push({ id: stagedDeleteId(issueKey), kind: "delete", issueKey, label: "Delete issue" })
  }
  for (const draft of state.configDrafts) {
    changes.push({ id: stagedConfigId(draft), kind: "config", draftId: draft.id, label: "Config", value: configDraftSummary(draft) })
  }
  return changes
}

export function stagedEditId(issueKey: string, fieldId: IssueEditableField) {
  return `edit:${issueKey}:${fieldId}`
}

export function stagedDeleteId(issueKey: string) {
  return `delete:${issueKey}`
}

export function stagedConfigId(draft: Pick<ConfigDraft, "id">) {
  return `config:${draft.id}`
}

export function stagedDiscardTargetIds(changes: StagedChange[], selectedIndex: number, selections: string[]) {
  if (selections.length) return new Set(selections)
  const fallback = changes[selectedIndex]?.id
  return new Set(fallback ? [fallback] : [])
}

export function discardedActiveEditors(
  changes: StagedChange[],
  discardedIds: Set<string>,
  selectedIssueKey: string,
  inspectorEditingFieldId?: IssueEditableField,
  detailBodyEditing = false,
) {
  let inspector = false
  let detailBody = false
  for (const change of changes) {
    if (!discardedIds.has(change.id) || change.kind !== "edit" || change.issueKey !== selectedIssueKey) continue
    if (change.fieldId === inspectorEditingFieldId) inspector = true
    if (change.fieldId === "description" && detailBodyEditing) detailBody = true
  }
  return { inspector, detailBody }
}

function stagedFieldLabel(fieldId: IssueEditableField) {
  if (fieldId === "description") return "Body"
  return issueFields.find((field) => field.id === fieldId)?.label ?? fieldId
}
