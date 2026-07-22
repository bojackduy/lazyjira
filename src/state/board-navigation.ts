import type { AppState, BoardMode } from "./app-state"
import { configuredStatuses } from "./config-drafts"
import { issueByKey } from "./issue-drafts"
import { boardGroupsForMode } from "./selectors"

export type BoardLocation = {
  groupIndex: number
  statusIndex: number
  itemIndex: number
}

export function boardCellIssueKeys(state: AppState, mode: BoardMode, groupIndex: number, statusIndex: number) {
  const group = boardGroupsForMode(state, mode)[groupIndex]
  const status = configuredStatuses(state)[statusIndex]
  if (!group || !status) return []
  return group.issueKeys.filter((issueKey) => issueByKey(state, issueKey)?.statusId === status.id)
}

export function boardIssueKeyAtLocation(state: AppState, mode: BoardMode, location: BoardLocation) {
  return boardCellIssueKeys(state, mode, location.groupIndex, location.statusIndex)[location.itemIndex]
}

export function selectedBoardLocation(state: AppState, mode: BoardMode, issueKey = state.selectedIssueKey): BoardLocation | undefined {
  const groups = boardGroupsForMode(state, mode)
  const statuses = configuredStatuses(state)
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    for (let statusIndex = 0; statusIndex < statuses.length; statusIndex++) {
      const issueKeys = boardCellIssueKeys(state, mode, groupIndex, statusIndex)
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
      if (boardCellIssueKeys(state, mode, groupIndex, statusIndex).length) return { groupIndex, statusIndex, itemIndex: 0 }
    }
  }
  return
}

export function nextKanbanHorizontalLocation(state: AppState, location: BoardLocation, delta: 1 | -1): BoardLocation | undefined {
  const sameGroup = nextOccupiedStatusInGroup(state, location, delta)
  if (sameGroup) return sameGroup

  const occupied = occupiedBoardCells(state, "kanban")
  const currentIndex = occupied.findIndex((cell) => cell.groupIndex === location.groupIndex && cell.statusIndex === location.statusIndex)
  if (currentIndex === -1) return
  return occupied[currentIndex + delta]
}

function nextOccupiedStatusInGroup(state: AppState, location: BoardLocation, delta: 1 | -1): BoardLocation | undefined {
  const statuses = configuredStatuses(state)
  for (let statusIndex = location.statusIndex + delta; statusIndex >= 0 && statusIndex < statuses.length; statusIndex += delta) {
    const issueKeys = boardCellIssueKeys(state, "kanban", location.groupIndex, statusIndex)
    if (issueKeys.length) return { groupIndex: location.groupIndex, statusIndex, itemIndex: Math.min(location.itemIndex, issueKeys.length - 1) }
  }
  return
}

function occupiedBoardCells(state: AppState, mode: BoardMode) {
  const cells: BoardLocation[] = []
  const groups = boardGroupsForMode(state, mode)
  const statuses = configuredStatuses(state)
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
    for (let statusIndex = 0; statusIndex < statuses.length; statusIndex++) {
      if (boardCellIssueKeys(state, mode, groupIndex, statusIndex).length) cells.push({ groupIndex, statusIndex, itemIndex: 0 })
    }
  }
  return cells
}
