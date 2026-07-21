import type { AppState, IssueSummary, IssueTypeDefinition, SprintSummary, StatusDefinition } from "./app-state"

const statuses: StatusDefinition[] = [
  { id: "todo", name: "To Do", category: "todo", color: "#64748B" },
  { id: "in-progress", name: "In Progress", category: "in-progress", color: "#38BDF8" },
  { id: "code-review", name: "Code Review", category: "review", color: "#A78BFA" },
  { id: "qa", name: "QA", category: "review", color: "#F59E0B" },
  { id: "blocked", name: "Blocked", category: "blocked", color: "#EF4444" },
  { id: "done", name: "Done", category: "done", color: "#22C55E" },
]

const issueTypes: IssueTypeDefinition[] = [
  { id: "Epic", name: "Epic", color: "#A855F7" },
  { id: "Feature", name: "Feature", color: "#06B6D4" },
  { id: "Story", name: "Story", color: "#22C55E" },
  { id: "Task", name: "Task", color: "#3B82F6" },
  { id: "Subtask", name: "Subtask", color: "#94A3B8" },
  { id: "Bug", name: "Bug", color: "#EF4444" },
]

const sprints: SprintSummary[] = [
  { id: "sprint-24", name: "Sprint 24", goal: "Stabilize auth, checkout, and board triage", state: "active" },
  { id: "sprint-25", name: "Sprint 25", goal: "Improve planning and docs reading", state: "future" },
  { id: "sprint-26", name: "Sprint 26", goal: "Bulk workflows and saved team layouts", state: "future" },
]

const issueDescriptions = {
  auth: `# Fix login redirect

Users who authenticate from an expired Jira session are redirected to the workspace home instead of the original issue.

## Expected behavior

- Preserve the original issue URL before the OAuth handoff.
- Restore the selected board and issue after login.
- Show an actionable error when the Jira tenant rejects the callback.

## Acceptance criteria

| Case | Result |
| --- | --- |
| Expired token | User returns to selected issue |
| Missing state | User sees recovery action |
| Invalid tenant | Error names the tenant and board |

\`\`\`ts
redirectToJira({ returnTo: selectedIssue.url })
\`\`\``,
  board: `# Configurable board grouping

The board must support swimlanes that come from Jira fields or team-defined custom fields.

## Group candidates

- Assignee
- Epic
- Feature
- Space/component
- Issue type
- Priority

> Jira workflows are configurable, so grouping and status coloring must come from data, not hardcoded enum assumptions.`,
  backlog: `# Backlog planning surface

Backlog should default to sprint sections but preserve a generic grouping model.

## Planning cues

- Active sprint capacity
- Future sprint commitments
- Unassigned work
- Blocked and stale work
- Items without story points`,
} as const

const issues: IssueSummary[] = [
  {
    key: "PROJ-101",
    title: "Authentication platform refresh",
    type: "Epic",
    priority: "Critical",
    statusId: "in-progress",
    assignee: "Duy",
    reporter: "Mina",
    epic: "Authentication platform refresh",
    feature: "Identity",
    space: "Platform",
    sprintId: "sprint-24",
    storyPoints: 13,
    labels: ["auth", "platform"],
    components: ["Identity"],
    blocked: false,
    staleDays: 1,
    description: issueDescriptions.auth,
    comments: [
      { id: "c1", author: "Mina", age: "2h", body: "OAuth callback behavior is the release blocker." },
      { id: "c2", author: "Duy", age: "30m", body: "Added tenant-specific reproduction notes." },
    ],
    links: ["PROJ-128", "PROJ-142"],
  },
  {
    key: "PROJ-128",
    title: "Fix login redirect after expired session",
    type: "Bug",
    priority: "High",
    statusId: "blocked",
    assignee: "Duy",
    reporter: "Mina",
    epic: "Authentication platform refresh",
    feature: "OAuth recovery",
    space: "Platform",
    sprintId: "sprint-24",
    storyPoints: 5,
    labels: ["auth", "release-blocker"],
    components: ["Identity", "Routing"],
    blocked: true,
    staleDays: 8,
    description: issueDescriptions.auth,
    comments: [{ id: "c3", author: "An", age: "1d", body: "Blocked on tenant callback config from Jira admin." }],
    links: ["PROJ-101"],
  },
  {
    key: "PROJ-142",
    title: "Persist original issue URL through OAuth",
    type: "Story",
    priority: "High",
    statusId: "code-review",
    assignee: "An",
    reporter: "Duy",
    epic: "Authentication platform refresh",
    feature: "OAuth recovery",
    space: "Platform",
    sprintId: "sprint-24",
    storyPoints: 3,
    labels: ["auth"],
    components: ["Identity"],
    blocked: false,
    staleDays: 2,
    description: "# Persist original issue URL\n\nStore the selected issue and board context before redirecting to Jira OAuth.",
    comments: [{ id: "c4", author: "Linh", age: "4h", body: "Reviewing the route restoration edge cases." }],
    links: ["PROJ-128"],
  },
  {
    key: "PROJ-143",
    title: "Add callback state validation copy",
    type: "Subtask",
    priority: "Medium",
    statusId: "qa",
    assignee: "Linh",
    reporter: "An",
    epic: "Authentication platform refresh",
    feature: "OAuth recovery",
    space: "Platform",
    sprintId: "sprint-24",
    parentKey: "PROJ-142",
    storyPoints: 1,
    labels: ["auth", "copy"],
    components: ["Identity"],
    blocked: false,
    staleDays: 1,
    description: "# Callback state validation copy\n\nMake auth failures actionable and include the Jira tenant name.",
    comments: [],
    links: ["PROJ-142"],
  },
  {
    key: "PROJ-170",
    title: "Configurable board grouping",
    type: "Feature",
    priority: "High",
    statusId: "in-progress",
    assignee: "Mina",
    reporter: "Duy",
    epic: "Planning workspace",
    feature: "Board swimlanes",
    space: "Planning",
    sprintId: "sprint-24",
    storyPoints: 8,
    labels: ["board", "grouping"],
    components: ["Board"],
    blocked: false,
    staleDays: 3,
    description: issueDescriptions.board,
    comments: [{ id: "c5", author: "Duy", age: "3h", body: "Need feature, assignee, and custom field grouping in the mock." }],
    links: ["PROJ-171", "PROJ-172"],
  },
  {
    key: "PROJ-171",
    title: "Group Kanban by feature",
    type: "Story",
    priority: "Medium",
    statusId: "todo",
    assignee: "Mina",
    reporter: "Duy",
    epic: "Planning workspace",
    feature: "Board swimlanes",
    space: "Planning",
    sprintId: "sprint-24",
    storyPoints: 5,
    labels: ["board"],
    components: ["Board"],
    blocked: false,
    staleDays: 0,
    description: "# Group Kanban by feature\n\nShow feature swimlanes across editable Jira workflow statuses.",
    comments: [],
    links: ["PROJ-170"],
  },
  {
    key: "PROJ-172",
    title: "Color cards by issue type and status",
    type: "Task",
    priority: "High",
    statusId: "code-review",
    assignee: "Duy",
    reporter: "Mina",
    epic: "Planning workspace",
    feature: "Board swimlanes",
    space: "Planning",
    sprintId: "sprint-24",
    storyPoints: 3,
    labels: ["board", "color"],
    components: ["Board"],
    blocked: false,
    staleDays: 1,
    description: "# Color cards\n\nUse issue type color for the card marker and status color for the card border/status chip.",
    comments: [{ id: "c6", author: "Mina", age: "1h", body: "This should make board density easier to scan." }],
    links: ["PROJ-170"],
  },
  {
    key: "PROJ-180",
    title: "Checkout retry messaging",
    type: "Bug",
    priority: "Medium",
    statusId: "in-progress",
    assignee: "Linh",
    reporter: "Bao",
    epic: "Checkout reliability",
    feature: "Payment recovery",
    space: "Commerce",
    sprintId: "sprint-24",
    storyPoints: 3,
    labels: ["checkout", "bug"],
    components: ["Payments"],
    blocked: false,
    staleDays: 1,
    description: "# Checkout retry messaging\n\nClarify retryable gateway errors without hiding the provider response.",
    comments: [],
    links: [],
  },
  {
    key: "PROJ-181",
    title: "Gateway timeout retry policy",
    type: "Task",
    priority: "Critical",
    statusId: "blocked",
    assignee: "Bao",
    reporter: "Linh",
    epic: "Checkout reliability",
    feature: "Payment recovery",
    space: "Commerce",
    sprintId: "sprint-24",
    storyPoints: 5,
    labels: ["checkout", "gateway"],
    components: ["Payments"],
    blocked: true,
    staleDays: 9,
    description: "# Gateway timeout retry policy\n\nBlocked until payment provider confirms retry safety for duplicated charge attempts.",
    comments: [{ id: "c7", author: "Bao", age: "2d", body: "Waiting for provider confirmation." }],
    links: ["PROJ-180"],
  },
  {
    key: "PROJ-190",
    title: "Backlog rank preview",
    type: "Feature",
    priority: "Medium",
    statusId: "todo",
    assignee: "An",
    reporter: "Duy",
    epic: "Backlog grooming",
    feature: "Planning actions",
    space: "Planning",
    sprintId: "sprint-25",
    storyPoints: 8,
    labels: ["backlog", "ranking"],
    components: ["Backlog"],
    blocked: false,
    staleDays: 4,
    description: issueDescriptions.backlog,
    comments: [],
    links: [],
  },
  {
    key: "PROJ-191",
    title: "Move issue to sprint dialog",
    type: "Story",
    priority: "Medium",
    statusId: "todo",
    assignee: "Unassigned",
    reporter: "An",
    epic: "Backlog grooming",
    feature: "Planning actions",
    space: "Planning",
    sprintId: "sprint-25",
    storyPoints: 5,
    labels: ["backlog"],
    components: ["Backlog"],
    blocked: false,
    staleDays: 6,
    description: "# Move issue to sprint dialog\n\nShow source section, target sprint, and exact issue key before applying later write operations.",
    comments: [],
    links: ["PROJ-190"],
  },
  {
    key: "PROJ-193",
    title: "Sprint capacity warning panel",
    type: "Task",
    priority: "Low",
    statusId: "todo",
    assignee: "Mina",
    reporter: "Duy",
    epic: "Backlog grooming",
    feature: "Planning actions",
    space: "Planning",
    sprintId: "sprint-26",
    storyPoints: 3,
    labels: ["capacity"],
    components: ["Backlog"],
    blocked: false,
    staleDays: 1,
    description: "# Sprint capacity warning panel\n\nFlag overloaded future sprints and unpointed work before planning starts.",
    comments: [],
    links: [],
  },
  {
    key: "PROJ-210",
    title: "Confluence-style issue description renderer",
    type: "Story",
    priority: "High",
    statusId: "todo",
    assignee: "Duy",
    reporter: "Mina",
    epic: "Issue reader",
    feature: "Rich detail view",
    space: "Knowledge",
    storyPoints: 5,
    labels: ["markdown", "detail"],
    components: ["Issue Detail"],
    blocked: false,
    staleDays: 3,
    description: `# Confluence-style issue description renderer

Render Jira descriptions with markdown-like semantics while preserving board context.

## Must support now

- Headings
- Lists
- Tables
- Code blocks
- Blockquotes

Images and videos can come later.`,
    comments: [{ id: "c8", author: "Duy", age: "today", body: "Use OpenTUI markdown instead of a hand-rolled renderer." }],
    links: [],
  },
  {
    key: "PROJ-211",
    title: "Inline linked docs preview",
    type: "Task",
    priority: "Low",
    statusId: "todo",
    assignee: "Unassigned",
    reporter: "Mina",
    epic: "Issue reader",
    feature: "Rich detail view",
    space: "Knowledge",
    storyPoints: 2,
    labels: ["docs"],
    components: ["Issue Detail"],
    blocked: false,
    staleDays: 11,
    description: "# Inline linked docs preview\n\nSurface related docs beside the selected issue without making docs the default landing page.",
    comments: [],
    links: ["PROJ-210"],
  },
]

export function loadDemoWorkspace(): AppState {
  const activeSprintId = "sprint-24"
  const enrichedIssues = issues.map(enrichIssue)
  const issueMap = Object.fromEntries(enrichedIssues.map((issue) => [issue.key, issue]))
  const activeSprintIssues = enrichedIssues.filter((issue) => issue.sprintId === activeSprintId)
  const done = enrichedIssues.filter((issue) => statuses.find((status) => status.id === issue.statusId)?.category === "done").length
  const inProgress = enrichedIssues.filter((issue) =>
    ["in-progress", "review", "blocked"].includes(statuses.find((status) => status.id === issue.statusId)?.category ?? ""),
  ).length

  return {
    demoMode: true,
    route: "active-sprint",
    previousRoute: undefined,
    focusedPane: "main",
    sidebarSelectedIndex: 1,
    project: { key: "PROJ", name: "Product App" },
    board: { id: "demo-board", name: "Product Scrum", type: "scrum" },
    currentUser: "Duy",
    quickFilters: [
      { id: "mine", label: "Only My Issues" },
      { id: "blocked", label: "Blocked" },
      { id: "stale", label: "Stale" },
      { id: "unassigned", label: "Unassigned" },
    ],
    activeQuickFilters: [],
    activeSprintId,
    sprints,
    statuses,
    issueTypes,
    columns: statuses.map((status) => ({
      id: status.id,
      name: status.name,
      issueKeys: activeSprintIssues.filter((issue) => issue.statusId === status.id).map((issue) => issue.key),
    })),
    issues: issueMap,
    activeSprintGroupBy: "none",
    kanbanGroupBy: "feature",
    backlogGroupBy: "sprint",
    activeSprintStatusOffset: 0,
    kanbanStatusOffset: 0,
    selectedIssueKey: "PROJ-128",
    inspectorSelectedFieldIndex: 1,
    inspectorEditValue: "",
    issueDrafts: {},
    issueDeletes: [],
    pendingDeleteIssueKey: undefined,
    detailBodyEditing: false,
    detailBodyEditValue: "",
    draftIssueCounter: 1,
    stats: {
      todo: enrichedIssues.filter((issue) => statuses.find((status) => status.id === issue.statusId)?.category === "todo").length,
      inProgress,
      done,
      blocked: enrichedIssues.filter((issue) => issue.blocked || issue.statusId === "blocked").length,
      stale: enrichedIssues.filter((issue) => issue.staleDays >= 7).length,
      unassigned: enrichedIssues.filter((issue) => issue.assignee === "Unassigned").length,
    },
  }
}

function enrichIssue(issue: IssueSummary, index: number): IssueSummary {
  const dueDay = String(8 + (index % 18)).padStart(2, "0")
  return {
    ...issue,
    estimate: issue.storyPoints ? issue.storyPoints * 2 : undefined,
    dueDate: `2026-08-${dueDay}`,
    createdAt: `2026-07-${String(1 + (index % 12)).padStart(2, "0")}`,
    updatedAt: `2026-07-${String(12 + (index % 10)).padStart(2, "0")}`,
    resolution: statuses.find((status) => status.id === issue.statusId)?.category === "done" ? "Done" : undefined,
    fixVersions: index % 3 === 0 ? ["2026.08"] : [],
    affectsVersions: issue.type === "Bug" ? ["2026.07"] : [],
    rank: `R-${String(index + 1).padStart(3, "0")}`,
  }
}
