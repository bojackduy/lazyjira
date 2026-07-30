import type { AppState, IssuePageState, IssueSummary, TimelineStartDateField, TimelineZoom } from "./app-state"
import { projectListIssuePageSourceId } from "./issue-pages"
import { issuesForSource } from "./selectors"

export type TimelineRowGroup = "hierarchy" | "missing-parent" | "invalid-hierarchy"
export type TimelineRowClassification = "scheduled" | "start-only" | "due-only" | "unscheduled" | "missing-parent" | "invalid-hierarchy"

export type TimelineHierarchyRow = {
  issue: IssueSummary
  depth: number
  group: TimelineRowGroup
  classification: TimelineRowClassification
}

export type TimelineProjectedRow = TimelineHierarchyRow & {
  hasChildren: boolean
  collapsed: boolean
}

export type TimelineHierarchyModel = {
  rows: TimelineHierarchyRow[]
  loaded: number
  total?: number
  partial: boolean
  startDateField: TimelineStartDateField
  parentHydrationError?: string
}

export type TimelineLayout = {
  wide: boolean
  viewportWidth: number
  identityWidth: number
  cellWidth: number
  cellCount: number
}

export type TimelineCell = {
  start: string
  end: string
  label: string
  today: boolean
}

export type TimelineSchedule = {
  kind: "bar" | "marker" | "text"
  cells?: string[]
  text: string
}

const millisecondsPerDay = 86_400_000

export function timelineModel(state: AppState): TimelineHierarchyModel {
  const projectKeys = state.issueKeysBySource[projectListIssuePageSourceId] ?? []
  const filteredKeys = issuesForSource(state, projectListIssuePageSourceId).map((issue) => issue.key)
  const model = buildTimelineHierarchy(
    state.issues,
    filteredKeys,
    state.issuePageStateBySource[projectListIssuePageSourceId],
    state.timelineStartDateField,
    state.timelineParentHydrationError,
  )
  return { ...model, loaded: unique(projectKeys).filter((key) => !!state.issues[key]).length }
}

export function buildTimelineHierarchy(issuesByKey: Record<string, IssueSummary>, projectIssueKeys: string[], page: IssuePageState | undefined, startDateField: TimelineStartDateField = { status: "unavailable", reason: "not-found" }, parentHydrationError?: string): TimelineHierarchyModel {
  const baseKeys = unique(projectIssueKeys).filter((key) => !!issuesByKey[key])
  const baseOrder = new Map(baseKeys.map((key, index) => [key, index]))
  const includedKeys: string[] = []
  const included = new Set<string>()

  const includeAncestors = (key: string, path: Set<string>) => {
    if (included.has(key) || path.has(key)) return
    const issue = issuesByKey[key]
    if (!issue) return
    path.add(key)
    if (issue.parentKey && issuesByKey[issue.parentKey]) includeAncestors(issue.parentKey, path)
    path.delete(key)
    if (!included.has(key)) {
      included.add(key)
      includedKeys.push(key)
    }
  }
  for (const key of baseKeys) includeAncestors(key, new Set())

  const order = new Map(includedKeys.map((key, index) => [key, index]))
  const children = new Map<string, string[]>()
  for (const key of includedKeys) {
    const parentKey = issuesByKey[key]?.parentKey
    if (!parentKey || !included.has(parentKey)) continue
    const list = children.get(parentKey) ?? []
    list.push(key)
    children.set(parentKey, list)
  }
  for (const list of children.values()) list.sort((left, right) => order.get(left)! - order.get(right)!)

  const invalid = invalidHierarchyKeys(includedKeys, issuesByKey, included)
  const missingRoots = new Set(includedKeys.filter((key) => {
    const parentKey = issuesByKey[key]?.parentKey
    return !!parentKey && !included.has(parentKey) && !invalid.has(key)
  }))
  const missing = descendantsOf(missingRoots, children, invalid)
  const rows: TimelineHierarchyRow[] = []
  const visited = new Set<string>()

  const appendTree = (key: string, depth: number, group: TimelineRowGroup) => {
    if (visited.has(key) || invalid.has(key)) return
    const issue = issuesByKey[key]
    if (!issue) return
    visited.add(key)
    rows.push({ issue, depth, group, classification: classifyTimelineIssue(issue, group) })
    for (const child of children.get(key) ?? []) appendTree(child, depth + 1, group)
  }

  for (const key of includedKeys) {
    const issue = issuesByKey[key]!
    if (!issue.parentKey && !invalid.has(key) && !missing.has(key)) appendTree(key, 0, "hierarchy")
  }
  for (const key of includedKeys) if (missingRoots.has(key)) appendTree(key, 0, "missing-parent")
  for (const key of [...includedKeys].sort((left, right) => (baseOrder.get(left) ?? Number.MAX_SAFE_INTEGER) - (baseOrder.get(right) ?? Number.MAX_SAFE_INTEGER))) {
    if (!invalid.has(key) || visited.has(key)) continue
    visited.add(key)
    rows.push({ issue: issuesByKey[key]!, depth: 0, group: "invalid-hierarchy", classification: "invalid-hierarchy" })
  }
  for (const key of includedKeys) if (!visited.has(key)) appendTree(key, 0, "hierarchy")

  const total = page?.total
  return {
    rows,
    loaded: baseKeys.length,
    total,
    partial: !page?.isLast || (typeof total === "number" && baseKeys.length < total),
    startDateField,
    parentHydrationError,
  }
}

export function projectTimelineRows(rows: TimelineHierarchyRow[], collapsedKeys: readonly string[]): TimelineProjectedRow[] {
  const collapsed = new Set(collapsedKeys)
  const result: TimelineProjectedRow[] = []
  let hiddenBelowDepth: number | undefined
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    if (hiddenBelowDepth !== undefined && row.depth > hiddenBelowDepth) continue
    hiddenBelowDepth = undefined
    const hasChildren = rows[index + 1]?.group === row.group && rows[index + 1]!.depth > row.depth
    const isCollapsed = hasChildren && collapsed.has(row.issue.key)
    result.push({ ...row, hasChildren, collapsed: isCollapsed })
    if (isCollapsed) hiddenBelowDepth = row.depth
  }
  return result
}

export function timelineSelection(rows: readonly Pick<TimelineHierarchyRow, "issue">[], selectedKey: string | undefined, delta: number | "first" | "last") {
  const keys = rows.map((row) => row.issue.key)
  if (!keys.length) return undefined
  if (delta === "first") return keys[0]
  if (delta === "last") return keys.at(-1)
  const current = Math.max(0, keys.indexOf(selectedKey ?? ""))
  return keys[Math.max(0, Math.min(keys.length - 1, current + delta))]
}

export function classifyTimelineIssue(issue: Pick<IssueSummary, "startDate" | "dueDate">, group: TimelineRowGroup = "hierarchy"): TimelineRowClassification {
  if (group === "invalid-hierarchy") return "invalid-hierarchy"
  if (group === "missing-parent") return "missing-parent"
  const hasStart = isJiraDate(issue.startDate)
  const hasDue = isJiraDate(issue.dueDate)
  if (hasStart && hasDue) return "scheduled"
  if (hasStart) return "start-only"
  if (hasDue) return "due-only"
  return "unscheduled"
}

export function timelineDateBounds(rows: TimelineHierarchyRow[]) {
  const dates = rows.flatMap((row) => [row.issue.startDate, row.issue.dueDate]).filter(isJiraDate).sort()
  return dates.length ? { start: dates[0]!, end: dates[dates.length - 1]! } : undefined
}

export function timelineLayout(terminalWidth: number, zoom: TimelineZoom): TimelineLayout {
  const viewportWidth = Math.max(32, terminalWidth < 100 ? terminalWidth - 4 : terminalWidth - 70)
  const identityWidth = Math.min(40, Math.max(26, Math.floor(viewportWidth * 0.45)))
  const cellWidth = zoom === "day" ? 2 : zoom === "week" ? 5 : 8
  const cellCount = Math.max(0, Math.floor((viewportWidth - identityWidth) / cellWidth))
  return { wide: cellCount >= 7, viewportWidth, identityWidth, cellWidth, cellCount: Math.max(1, cellCount) }
}

export function timelineCells(windowStart: string, zoom: TimelineZoom, count: number, today: string): TimelineCell[] {
  const alignedStart = alignTimelineDate(windowStart, zoom)
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const start = addTimelineUnits(alignedStart, zoom, index)
    const end = addDays(addTimelineUnits(start, zoom, 1), -1)
    return { start, end, label: timelineCellLabel(start, zoom), today: compareDates(today, start) >= 0 && compareDates(today, end) <= 0 }
  })
}

export function timelineSchedule(issue: Pick<IssueSummary, "startDate" | "dueDate">, cells: TimelineCell[]): TimelineSchedule {
  const start = isJiraDate(issue.startDate) ? issue.startDate : undefined
  const due = isJiraDate(issue.dueDate) ? issue.dueDate : undefined
  if (!start && !due) return { kind: "text", text: "unscheduled" }
  if (start && due && compareDates(start, due) > 0) return { kind: "text", text: `invalid range · Start ${formatTimelineDate(start)} · Due ${formatTimelineDate(due)}` }
  if (!cells.length) return { kind: start && due ? "bar" : "marker", cells: [], text: timelineScheduleText(issue) }
  const first = cells[0]!
  const last = cells[cells.length - 1]!
  const outsideWindow = (date: string) => compareDates(date, first.start) < 0 ? "before" : compareDates(date, last.end) > 0 ? "after" : undefined
  if (start && due) {
    const outside = compareDates(due, first.start) < 0 ? "before" : compareDates(start, last.end) > 0 ? "after" : undefined
    return {
      kind: "bar",
      cells: outside ? edgeCells(cells.length, outside) : cells.map((cell) => rangesOverlap(start, due, cell.start, cell.end) ? "bar" : "empty"),
      text: timelineScheduleText(issue),
    }
  }
  const date = start ?? due!
  const outside = outsideWindow(date)
  return {
    kind: "marker",
    cells: outside ? edgeCells(cells.length, outside) : cells.map((cell) => compareDates(date, cell.start) >= 0 && compareDates(date, cell.end) <= 0 ? "marker" : "empty"),
    text: timelineScheduleText(issue),
  }
}

function edgeCells(length: number, edge: "before" | "after") {
  return Array.from({ length }, (_, index) => edge === "before" && index === 0 ? "before" : edge === "after" && index === length - 1 ? "after" : "empty")
}

export function timelineScheduleText(issue: Pick<IssueSummary, "startDate" | "dueDate">) {
  const start = isJiraDate(issue.startDate) ? issue.startDate : undefined
  const due = isJiraDate(issue.dueDate) ? issue.dueDate : undefined
  if (start && due) return compareDates(start, due) <= 0
    ? `${formatTimelineDate(start)} -> ${formatTimelineDate(due)}`
    : `invalid range · Start ${formatTimelineDate(start)} · Due ${formatTimelineDate(due)}`
  if (start) return `Start ${formatTimelineDate(start)} only`
  if (due) return `Due ${formatTimelineDate(due)} only`
  return "unscheduled"
}

export function timelineRowCopy(row: TimelineHierarchyRow) {
  if (row.group === "missing-parent") return `parent not loaded: ${row.issue.parentKey ?? "unknown"} · ${timelineScheduleText(row.issue)}`
  if (row.group === "invalid-hierarchy") return `invalid hierarchy · ${timelineScheduleText(row.issue)}`
  return timelineScheduleText(row.issue)
}

export function timelineStateText(state: AppState, model = timelineModel(state)) {
  const page = state.issuePageStateBySource[projectListIssuePageSourceId]
  if (!page) return `Loading ${state.project.key} Timeline project issues...`
  if (page.loading && !model.loaded) return `Loading ${state.project.key} Timeline project issues...`
  if (page.error && !model.loaded && /Jira 403|permission|access denied/i.test(page.error)) return `Timeline for ${state.project.key} requires Browse Projects and issue access. ${page.error}`
  if (page.error && !model.loaded) return `Timeline for ${state.project.key} failed: ${page.error}`
  if (page.refreshing) return `Refreshing Timeline · ${completeness(model)} retained...`
  if (page.error) return `Timeline append failed; ${model.loaded} rows retained · L retry: ${page.error}`
  if (!model.rows.length && model.loaded) return `No loaded Timeline issues match the active filters. ${model.loaded} project issues remain loaded.`
  if (!model.loaded && page.isLast) return `Jira returned no issues for project ${state.project.key}.`
  return model.partial ? `${completeness(model)} project issues loaded · partial · L load more` : `${completeness(model)} project issues loaded · complete`
}

export function timelineNotices(model: TimelineHierarchyModel) {
  const notices: string[] = []
  if (model.startDateField.status === "unavailable") notices.push(model.startDateField.reason === "ambiguous" ? "Start date unavailable: multiple Jira date fields matched; showing Due-only and unscheduled rows." : "Start date field unavailable; showing Due-only and unscheduled rows.")
  if (model.parentHydrationError) notices.push(`Parent hydration incomplete: ${model.parentHydrationError}`)
  return notices
}

export function cycleTimelineZoom(zoom: TimelineZoom): TimelineZoom {
  return zoom === "day" ? "week" : zoom === "week" ? "month" : "day"
}

export function panTimelineWindow(windowStart: string, zoom: TimelineZoom, units: number) {
  return addTimelineUnits(alignTimelineDate(windowStart, zoom), zoom, units)
}

export function timelineTodayWindow(today: string, zoom: TimelineZoom) {
  return alignTimelineDate(today, zoom)
}

export function timelineWindowEnd(windowStart: string, zoom: TimelineZoom, count: number) {
  return addDays(addTimelineUnits(alignTimelineDate(windowStart, zoom), zoom, Math.max(1, count)), -1)
}

export function formatTimelineDate(value: string) {
  const date = parseDate(value)
  return `${monthNames[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, "0")}`
}

function completeness(model: TimelineHierarchyModel) {
  return `${model.loaded}${typeof model.total === "number" ? `/${model.total}` : ""}`
}

function invalidHierarchyKeys(keys: string[], issuesByKey: Record<string, IssueSummary>, included: Set<string>) {
  const invalid = new Set<string>()
  for (const key of keys) {
    const path: string[] = []
    const positions = new Map<string, number>()
    let current: string | undefined = key
    while (current && included.has(current)) {
      if (invalid.has(current)) {
        for (const candidate of path) invalid.add(candidate)
        break
      }
      const cycleAt = positions.get(current)
      if (cycleAt !== undefined) {
        for (const candidate of path) invalid.add(candidate)
        invalid.add(current)
        break
      }
      positions.set(current, path.length)
      path.push(current)
      current = issuesByKey[current]?.parentKey
    }
  }
  return invalid
}

function descendantsOf(roots: Set<string>, children: Map<string, string[]>, excluded: Set<string>) {
  const result = new Set<string>()
  const visit = (key: string) => {
    if (result.has(key) || excluded.has(key)) return
    result.add(key)
    for (const child of children.get(key) ?? []) visit(child)
  }
  for (const root of roots) visit(root)
  return result
}

function alignTimelineDate(value: string, zoom: TimelineZoom) {
  const date = parseDate(value)
  if (zoom === "month") return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`
  if (zoom === "week") return addDays(value, -((date.getUTCDay() + 6) % 7))
  return value
}

function addTimelineUnits(value: string, zoom: TimelineZoom, units: number) {
  if (zoom === "day") return addDays(value, units)
  if (zoom === "week") return addDays(value, units * 7)
  const date = parseDate(value)
  return formatDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + units, 1)))
}

function addDays(value: string, days: number) {
  return formatDate(new Date(parseDate(value).valueOf() + days * millisecondsPerDay))
}

function timelineCellLabel(value: string, zoom: TimelineZoom) {
  const date = parseDate(value)
  if (zoom === "day") return String(date.getUTCDate()).padStart(2, "0")
  if (zoom === "week") return `${monthNames[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, "0")}`
  return `${monthNames[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(2)}`
}

function rangesOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string) {
  return compareDates(leftStart, rightEnd) <= 0 && compareDates(leftEnd, rightStart) >= 0
}

function compareDates(left: string, right: string) {
  return left.localeCompare(right)
}

function parseDate(value: string) {
  if (!isJiraDate(value)) throw new Error(`Invalid Jira date: ${value}`)
  return new Date(`${value}T00:00:00Z`)
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function isJiraDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
}

function unique(values: string[]) {
  return [...new Set(values)]
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
