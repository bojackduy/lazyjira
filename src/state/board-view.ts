import type { AppState, BoardMode, StatusDefinition } from "./app-state"
import type { BoardCellItem } from "./board-navigation"
import { configuredStatuses } from "./config-drafts"
import { issueByKey } from "./issue-drafts"
import { boardGroupsForMode } from "./selectors"

export type BoardView = {
  groups: ReturnType<typeof boardGroupsForMode>
  statuses: StatusDefinition[]
  cells: BoardCellItem[][][]
}

export function boardView(state: AppState, mode: BoardMode): BoardView {
  const groups = boardGroupsForMode(state, mode)
  const statuses = configuredStatuses(state)
  return {
    groups,
    statuses,
    cells: groups.map((group) => statuses.map((status) => [
      ...group.issueKeys
        .filter((issueKey) => issueByKey(state, issueKey)?.statusId === status.id)
        .map((issueKey) => ({ kind: "issue" as const, issueKey })),
      { kind: "create" as const },
    ])),
  }
}
