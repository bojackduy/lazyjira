import type { StatusCategory, StatusColumn, StatusDefinition } from "../state/app-state"
import type { JiraBoardConfiguration } from "./client"

export type BoardMetadata = {
  statuses: StatusDefinition[]
  columns: StatusColumn[]
}

export function normalizeBoardConfiguration(config: JiraBoardConfiguration): BoardMetadata {
  const columns = config.columnConfig?.columns ?? []
  const statusCountByColumn = new Map(columns.map((column) => [column.name ?? "Column", column.statuses?.filter((status) => status.id).length ?? 0]))
  const statuses: StatusDefinition[] = []
  const statusColumns: StatusColumn[] = []

  for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
    const column = columns[columnIndex]
    if (!column) continue
    const columnName = column.name?.trim() || `Column ${columnIndex + 1}`
    const category = statusCategoryForColumn(columnName, columnIndex, columns.length)
    const statusIds = (column.statuses ?? []).flatMap((status) => status.id ? [status.id] : [])

    statusColumns.push({ id: columnId(columnName, columnIndex), name: columnName, issueKeys: [] })

    for (let statusIndex = 0; statusIndex < statusIds.length; statusIndex += 1) {
      statuses.push({
        id: statusIds[statusIndex]!,
        name: statusName(columnName, statusIndex, statusCountByColumn.get(columnName) ?? statusIds.length),
        category,
        color: statusColor(category),
      })
    }
  }

  return { statuses, columns: statusColumns }
}

function statusName(columnName: string, index: number, columnStatusCount: number) {
  return columnStatusCount > 1 ? `${columnName} ${index + 1}` : columnName
}

function columnId(columnName: string, index: number) {
  const slug = columnName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  return slug || `column-${index + 1}`
}

function statusCategoryForColumn(name: string, index: number, count: number): StatusCategory {
  const normalized = name.toLowerCase()
  if (normalized.includes("block")) return "blocked"
  if (normalized.includes("review") || normalized.includes("qa") || normalized.includes("test")) return "review"
  if (normalized.includes("progress") || normalized.includes("doing") || normalized.includes("develop")) return "in-progress"
  if (normalized.includes("done") || normalized.includes("closed") || normalized.includes("resolved")) return "done"
  if (index === count - 1 && count > 1) return "done"
  if (index > 0) return "in-progress"
  return "todo"
}

function statusColor(category: StatusCategory) {
  switch (category) {
    case "todo":
      return "#64748B"
    case "in-progress":
      return "#38BDF8"
    case "review":
      return "#A78BFA"
    case "blocked":
      return "#EF4444"
    case "done":
      return "#22C55E"
  }
}
