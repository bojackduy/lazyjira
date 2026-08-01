export const iconModes = ["nerd", "unicode", "ascii"] as const

export type IconMode = (typeof iconModes)[number]

export type SemanticIconCatalog = {
  mode: IconMode
  structural: {
    selection: string
    collapsed: string
    expanded: string
    leaf: string
    create: string
    missingParent: string
    invalidHierarchy: string
  }
  issueType: {
    bug: string
    story: string
    task: string
    epic: string
    feature: string
    initiative: string
    subtask: string
    hierarchy: string
    generic: string
  }
  status: {
    todo: string
    inProgress: string
    review: string
    done: string
    blocked: string
    rejected: string
    reopened: string
    ready: string
    planned: string
    generic: string
  }
  priority: {
    lowest: string
    low: string
    medium: string
    high: string
    highest: string
    critical: string
    generic: string
  }
  route: {
    workspace: string
    timeline: string
    backlog: string
    list: string
    board: string
    config: string
    issueDetail: string
  }
  action: {
    create: string
    refresh: string
    search: string
    edit: string
    assign: string
    transition: string
    comment: string
    priority: string
    open: string
    copy: string
    delete: string
    apply: string
  }
  exceptional: {
    parent: string
    blocked: string
    stale: string
    unassigned: string
    loading: string
    empty: string
    warning: string
    error: string
    staged: string
  }
}

export type IssueTypeIconMetadata = {
  name?: string
  subtask?: boolean
  hierarchyLevel?: number
}

export type StatusIconMetadata = {
  name?: string
  category?: "todo" | "in-progress" | "review" | "blocked" | "done"
}

export type IconSelector = {
  mode: IconMode
  catalog: SemanticIconCatalog
  issueType: (metadata: IssueTypeIconMetadata) => string
  status: (metadata: StatusIconMetadata) => string
  priority: (name?: string) => string
}

export const iconCatalogs: Readonly<Record<IconMode, SemanticIconCatalog>> = {
  nerd: {
    mode: "nerd",
    structural: { selection: "\uf0da", collapsed: "\uf054", expanded: "\uf078", leaf: "\uf111", create: "\uf067", missingParent: "\uf127", invalidHierarchy: "\uf071" },
    issueType: { bug: "\uf188", story: "\uf02d", task: "\uf0ae", epic: "\uf135", feature: "\uf005", initiative: "\uf0eb", subtask: "\uf0e8", hierarchy: "\uf1b3", generic: "\uf15c" },
    status: { todo: "\uf10c", inProgress: "\uf192", review: "\uf06e", done: "\uf058", blocked: "\uf05e", rejected: "\uf057", reopened: "\uf01e", ready: "\uf144", planned: "\uf073", generic: "\uf111" },
    priority: { lowest: "\uf103", low: "\uf063", medium: "\uf068", high: "\uf062", highest: "\uf102", critical: "\uf071", generic: "\uf068" },
    route: { workspace: "\uf015", timeline: "\uf0d0", backlog: "\uf03a", list: "\uf03a", board: "\uf00a", config: "\uf013", issueDetail: "\uf15c" },
    action: { create: "\uf067", refresh: "\uf021", search: "\uf002", edit: "\uf044", assign: "\uf007", transition: "\uf061", comment: "\uf075", priority: "\uf062", open: "\uf08e", copy: "\uf0c5", delete: "\uf1f8", apply: "\uf00c" },
    exceptional: { parent: "\uf0a4", blocked: "\uf05e", stale: "\uf017", unassigned: "\uf007", loading: "\uf110", empty: "\uf1da", warning: "\uf071", error: "\uf057", staged: "\uf0ae" },
  },
  unicode: {
    mode: "unicode",
    structural: { selection: "▌", collapsed: "▸", expanded: "▾", leaf: "·", create: "+", missingParent: "?", invalidHierarchy: "!" },
    issueType: { bug: "!", story: "□", task: "✓", epic: "◆", feature: "★", initiative: "▲", subtask: "↳", hierarchy: "◇", generic: "•" },
    status: { todo: "○", inProgress: "◉", review: "◐", done: "✓", blocked: "!", rejected: "×", reopened: "↻", ready: "▶", planned: "◷", generic: "●" },
    priority: { lowest: "⇊", low: "↓", medium: "–", high: "↑", highest: "⇈", critical: "!", generic: "·" },
    route: { workspace: "⌂", timeline: "↔", backlog: "≡", list: "☷", board: "▦", config: "⚙", issueDetail: "▤" },
    action: { create: "+", refresh: "↻", search: "⌕", edit: "✎", assign: "@", transition: "→", comment: "…", priority: "↑", open: "↗", copy: "⧉", delete: "×", apply: "✓" },
    exceptional: { parent: "↑", blocked: "⊘", stale: "◷", unassigned: "?", loading: "◌", empty: "∅", warning: "⚠", error: "×", staged: "±" },
  },
  ascii: {
    mode: "ascii",
    structural: { selection: ">", collapsed: ">", expanded: "v", leaf: ".", create: "+", missingParent: "?", invalidHierarchy: "!" },
    issueType: { bug: "!", story: "S", task: "T", epic: "E", feature: "F", initiative: "I", subtask: "s", hierarchy: "H", generic: "#" },
    status: { todo: "o", inProgress: "*", review: "r", done: "x", blocked: "!", rejected: "X", reopened: "R", ready: ">", planned: "p", generic: "." },
    priority: { lowest: "v", low: "v", medium: "-", high: "^", highest: "^", critical: "!", generic: "." },
    route: { workspace: "W", timeline: "T", backlog: "B", list: "L", board: "A", config: "C", issueDetail: "D" },
    action: { create: "+", refresh: "r", search: "/", edit: "e", assign: "a", transition: "s", comment: "c", priority: "p", open: "o", copy: "y", delete: "x", apply: "w" },
    exceptional: { parent: "^", blocked: "!", stale: "~", unassigned: "?", loading: "*", empty: "-", warning: "!", error: "x", staged: "+" },
  },
}

export function parseIconMode(value: unknown): IconMode {
  if (typeof value !== "string") return "unicode"
  const normalized = value.trim().toLowerCase()
  return iconModes.find((mode) => mode === normalized) ?? "unicode"
}

export function createIconSelector(mode: IconMode): IconSelector {
  const catalog = iconCatalogs[mode]
  return {
    mode,
    catalog,
    issueType: (metadata) => resolveIssueTypeIcon(catalog, metadata),
    status: (metadata) => resolveStatusIcon(catalog, metadata),
    priority: (name) => resolvePriorityIcon(catalog, name),
  }
}

export function selectIcons(value: unknown): IconSelector {
  return createIconSelector(parseIconMode(value))
}

export function selectIconsFromEnv(env: Readonly<Record<string, unknown>> = process.env): IconSelector {
  return selectIcons(env.LAZYJIRA_ICON_MODE)
}

export function resolveIssueTypeIcon(catalog: SemanticIconCatalog, metadata: IssueTypeIconMetadata): string {
  const common = commonIssueType(normalizeName(metadata.name))
  if (common) return catalog.issueType[common]
  if (metadata.subtask) return catalog.issueType.subtask
  if ((metadata.hierarchyLevel ?? 0) > 0) return catalog.issueType.hierarchy
  return catalog.issueType.generic
}

export function resolveStatusIcon(catalog: SemanticIconCatalog, metadata: StatusIconMetadata): string {
  const name = normalizeName(metadata.name)
  if (/blocked|impediment|waiting/.test(name)) return catalog.status.blocked
  if (/reject|declin/.test(name)) return catalog.status.rejected
  if (/reopen/.test(name)) return catalog.status.reopened
  if (/review|\bqa\b|quality assurance|\buat\b|acceptance/.test(name)) return catalog.status.review
  if (/planned|planning/.test(name)) return catalog.status.planned
  if (/\bready\b/.test(name)) return catalog.status.ready
  return catalog.status[statusCategoryToken(metadata.category)]
}

export function resolvePriorityIcon(catalog: SemanticIconCatalog, name?: string): string {
  const normalized = normalizeName(name)
  if (["lowest", "trivial"].includes(normalized)) return catalog.priority.lowest
  if (["low", "minor"].includes(normalized)) return catalog.priority.low
  if (["medium", "normal"].includes(normalized)) return catalog.priority.medium
  if (["high", "major"].includes(normalized)) return catalog.priority.high
  if (["highest", "urgent"].includes(normalized)) return catalog.priority.highest
  if (["critical", "blocker"].includes(normalized)) return catalog.priority.critical
  return catalog.priority.generic
}

function commonIssueType(name: string): keyof Pick<SemanticIconCatalog["issueType"], "bug" | "story" | "task" | "epic" | "feature" | "initiative" | "subtask"> | undefined {
  if (name === "bug") return "bug"
  if (name === "story" || name === "user story") return "story"
  if (name === "task") return "task"
  if (name === "epic") return "epic"
  if (name === "feature") return "feature"
  if (name === "initiative") return "initiative"
  if (name === "subtask" || name === "sub task") return "subtask"
  return undefined
}

function statusCategoryToken(category: StatusIconMetadata["category"]): "todo" | "inProgress" | "review" | "blocked" | "done" | "generic" {
  if (category === "in-progress") return "inProgress"
  return category ?? "generic"
}

function normalizeName(value?: string): string {
  return value?.trim().toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ") ?? ""
}
