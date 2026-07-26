import type { AppState, BoardLocation, BoardMode } from "./app-state"
import { configuredStatuses } from "./config-drafts"
import { issueByKey } from "./issue-drafts"
import { boardGroupsForMode } from "./selectors"

export type BoardCellItem = { kind: "issue"; issueKey: string } | { kind: "create" }

export function boardCellIssueKeys(state: AppState, mode: BoardMode, groupIndex: number, statusIndex: number) {
  return boardCellIssueKeysFor(boardGroupsForMode(state, mode), configuredStatuses(state), state, groupIndex, statusIndex)
}

function boardCellIssueKeysFor(groups: ReturnType<typeof boardGroupsForMode>, statuses: ReturnType<typeof configuredStatuses>, state: AppState, groupIndex: number, statusIndex: number) {
  const group = groups[groupIndex]
  const status = statuses[statusIndex]
  if (!group || !status) return []
  return group.issueKeys.filter((issueKey) => issueByKey(state, issueKey)?.statusId === status.id)
}

export function boardCellItems(state: AppState, mode: BoardMode, groupIndex: number, statusIndex: number): BoardCellItem[] {
  const groups = boardGroupsForMode(state, mode)
  const statuses = configuredStatuses(state)
  const group = groups[groupIndex]
  const status = statuses[statusIndex]
  if (!group || !status) return []
  return [...boardCellIssueKeysFor(groups, statuses, state, groupIndex, statusIndex).map((issueKey) => ({ kind: "issue" as const, issueKey })), { kind: "create" }]
}

export function boardItemAtLocation(state: AppState, mode: BoardMode, location: BoardLocation): BoardCellItem | undefined {
  return boardCellItems(state, mode, location.groupIndex, location.statusIndex)[location.itemIndex]
}

export function boardIssueKeyAtLocation(state: AppState, mode: BoardMode, location: BoardLocation) {
  const item = boardItemAtLocation(state, mode, location)
  return item?.kind === "issue" ? item.issueKey : undefined
}

export function selectedBoardLocation(state: AppState, mode: BoardMode, issueKey = state.selectedIssueKey): BoardLocation | undefined {
  const groups = boardGroupsForMode(state, mode)
  const statuses = configuredStatuses(state)
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    for (let statusIndex = 0; statusIndex < statuses.length; statusIndex++) {
      const issueKeys = boardCellIssueKeysFor(groups, statuses, state, groupIndex, statusIndex)
      const itemIndex = issueKeys.indexOf(issueKey)
      if (itemIndex !== -1) return { groupIndex, statusIndex, itemIndex }
    }
  }
  return
}

export function firstBoardLocation(state: AppState, mode: BoardMode): BoardLocation | undefined {
  const groups = boardGroupsForMode(state, mode)
  const statuses = configuredStatuses(state)
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    for (let statusIndex = 0; statusIndex < statuses.length; statusIndex++) {
      if (groups[groupIndex] && statuses[statusIndex]) return { groupIndex, statusIndex, itemIndex: 0 }
    }
  }
  return
}

export function selectedBoardItemLocation(state: AppState, mode: BoardMode): BoardLocation | undefined {
  const selected = state.selectedBoardLocations[mode]
  if (selected && boardItemAtLocation(state, mode, selected)) return selected
  return selectedBoardLocation(state, mode) ?? firstBoardLocation(state, mode)
}

export function nextKanbanHorizontalLocation(state: AppState, location: BoardLocation, delta: 1 | -1): BoardLocation | undefined {
  const statuses = configuredStatuses(state)
  const targetStatusIndex = location.statusIndex + delta
  if (targetStatusIndex < 0 || targetStatusIndex >= statuses.length) return
  const items = boardCellItems(state, "kanban", location.groupIndex, targetStatusIndex)
  if (!items.length) return
  return { groupIndex: location.groupIndex, statusIndex: targetStatusIndex, itemIndex: Math.min(location.itemIndex, items.length - 1) }
}
