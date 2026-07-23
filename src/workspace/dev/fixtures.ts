import type { BoardSummary, IssuePriority, IssueSummary, IssueType, IssueTypeDefinition, ProjectSummary, SprintSummary, StatusDefinition } from "../../state/app-state"
import { createLoadedWorkspace, type LoadedWorkspace } from "../types"

export const devProjects: Array<ProjectSummary & { id: string }> = [
  { id: "dev-proj", key: "PROJ", name: "Product Platform" },
  { id: "dev-mob", key: "MOB", name: "Mobile Apps" },
  { id: "dev-ops", key: "OPS", name: "Internal Operations" },
]

export const devBoardsByProjectKey: Record<string, BoardSummary[]> = {
  PROJ: [{ id: "dev-board-proj", name: "Product Kanban", type: "kanban" }],
  MOB: [{ id: "dev-board-mob", name: "Mobile Kanban", type: "kanban" }],
  OPS: [{ id: "dev-board-ops", name: "Ops Kanban", type: "kanban" }],
}

export const devStatuses: StatusDefinition[] = [
  { id: "todo", name: "To Do", category: "todo", color: "#64748B" },
  { id: "in-progress", name: "In Progress", category: "in-progress", color: "#38BDF8" },
  { id: "code-review", name: "Code Review", category: "review", color: "#A78BFA" },
  { id: "qa", name: "QA", category: "review", color: "#F59E0B" },
  { id: "blocked", name: "Blocked", category: "blocked", color: "#EF4444" },
  { id: "done", name: "Done", category: "done", color: "#22C55E" },
]

export const devIssueTypes: IssueTypeDefinition[] = [
  { id: "Epic", name: "Epic", color: "#A855F7" },
  { id: "Feature", name: "Feature", color: "#06B6D4" },
  { id: "Story", name: "Story", color: "#22C55E" },
  { id: "Task", name: "Task", color: "#3B82F6" },
  { id: "Subtask", name: "Subtask", color: "#94A3B8" },
  { id: "Bug", name: "Bug", color: "#EF4444" },
]

const devSprints: SprintSummary[] = [
  { id: "sprint-24", name: "Sprint 24", goal: "Stabilize auth, checkout, and board triage", state: "active" },
  { id: "sprint-25", name: "Sprint 25", goal: "Improve planning and docs reading", state: "future" },
  { id: "sprint-26", name: "Sprint 26", goal: "Bulk workflows and saved team layouts", state: "future" },
]

export function loadDevWorkspaceFixture(projectKeyOrId: string): LoadedWorkspace {
  const project = devProjects.find((candidate) => candidate.key === projectKeyOrId || candidate.id === projectKeyOrId) ?? devProjects[0]!
  const board = devBoardsByProjectKey[project.key]?.[0] ?? devBoardsByProjectKey.PROJ![0]!
  return createLoadedWorkspace({
    project: { key: project.key, name: project.name },
    board,
    activeSprintId: "sprint-24",
    sprints: devSprints,
    statuses: devStatuses,
    issueTypes: devIssueTypes,
    issues: devIssuesByProjectKey[project.key] ?? devIssuesByProjectKey.PROJ!,
    selectedIssueKey: selectedIssueByProjectKey[project.key],
  })
}

function issue(key: string, title: string, statusId: string, options: Partial<IssueSummary> = {}): IssueSummary {
  return {
    key,
    title,
    type: options.type ?? "Task",
    priority: options.priority ?? "Medium",
    statusId,
    assignee: options.assignee ?? "Duy",
    reporter: options.reporter ?? "Mina",
    sprintId: options.sprintId,
    storyPoints: options.storyPoints,
    labels: options.labels ?? [],
    components: options.components ?? [],
    blocked: options.blocked ?? statusId === "blocked",
    staleDays: options.staleDays ?? 0,
    description: options.description ?? `# ${title}\n\nDev fixture issue for ${key}.`,
    comments: options.comments ?? [],
    links: options.links ?? [],
    epic: options.epic,
    feature: options.feature,
    space: options.space,
  }
}

const selectedIssueByProjectKey: Record<string, string> = {
  PROJ: "PROJ-128",
  MOB: "MOB-22",
  OPS: "OPS-7",
}

const devIssuesByProjectKey: Record<string, IssueSummary[]> = {
  PROJ: [
    issue("PROJ-101", "Authentication platform refresh", "in-progress", { type: "Epic", priority: "Critical", sprintId: "sprint-24", storyPoints: 13, epic: "Authentication platform refresh", feature: "Identity", space: "Platform", labels: ["auth", "platform"] }),
    issue("PROJ-121", "OAuth setup wizard", "todo", { type: "Task", sprintId: "sprint-24", storyPoints: 3, epic: "Authentication platform refresh", feature: "Identity", space: "Platform", labels: ["auth"] }),
    issue("PROJ-128", "Fix login redirect after expired session", "blocked", { type: "Bug", priority: "High", sprintId: "sprint-24", storyPoints: 5, epic: "Authentication platform refresh", feature: "OAuth recovery", space: "Platform", labels: ["auth", "release-blocker"], staleDays: 8 }),
    issue("PROJ-142", "Retry failed payment webhooks", "code-review", { type: "Bug", priority: "High", sprintId: "sprint-24", storyPoints: 5, feature: "Billing", space: "Checkout" }),
    issue("PROJ-160", "Cleanup legacy labels", "todo", { type: "Task", priority: "Low", sprintId: "sprint-25", storyPoints: 2, feature: "Taxonomy", space: "Platform" }),
    issue("PROJ-170", "Improve board keyboard hints", "qa", { type: "Story", sprintId: "sprint-24", storyPoints: 3, feature: "Terminal UI", space: "Experience" }),
    issue("PROJ-181", "Document safe write review flow", "done", { type: "Task", priority: "Low", sprintId: "sprint-24", storyPoints: 2, feature: "Docs", space: "Experience" }),
    issue("PROJ-190", "Rank backlog with staged preview", "in-progress", { type: "Story", sprintId: "sprint-25", storyPoints: 8, feature: "Planning", space: "Product" }),
    issue("PROJ-201", "Expose blocked work queue", "done", { type: "Story", sprintId: "sprint-24", storyPoints: 3, feature: "Triage", space: "Product" }),
    issue("PROJ-205", "Move issue to future sprint", "todo", { type: "Task", priority: "Medium", storyPoints: 3, feature: "Planning", space: "Product" }),
    issue("PROJ-211", "Backfill owner for imported tickets", "todo", { type: "Task", priority: "Medium", assignee: "Unassigned", storyPoints: 0, feature: "Imports", space: "Operations", staleDays: 11 }),
  ],
  MOB: [
    issue("MOB-22", "Crash on app resume from camera permission", "blocked", { type: "Bug", priority: "Critical", sprintId: "sprint-24", storyPoints: 8, feature: "Camera", space: "iOS", staleDays: 9, labels: ["mobile", "crash"] }),
    issue("MOB-31", "Offline queue sync indicator", "in-progress", { type: "Story", sprintId: "sprint-24", storyPoints: 5, feature: "Offline", space: "Mobile Core" }),
    issue("MOB-39", "Android notification channel cleanup", "todo", { type: "Task", sprintId: "sprint-24", storyPoints: 2, feature: "Notifications", space: "Android" }),
    issue("MOB-44", "Tablet split view polish", "qa", { type: "Story", sprintId: "sprint-25", storyPoints: 3, feature: "Responsive UI", space: "iPad" }),
    issue("MOB-57", "Unassigned beta feedback triage", "todo", { type: "Task", assignee: "Unassigned", storyPoints: 0, feature: "Beta", space: "Research", staleDays: 12 }),
  ],
  OPS: [
    issue("OPS-7", "Rotate production API token", "in-progress", { type: "Task", priority: "Critical", sprintId: "sprint-24", storyPoints: 3, feature: "Security", space: "Platform Ops", labels: ["security"] }),
    issue("OPS-12", "Investigate nightly import failures", "blocked", { type: "Bug", priority: "High", sprintId: "sprint-24", storyPoints: 5, feature: "Imports", space: "Data", staleDays: 10 }),
    issue("OPS-19", "Document incident handoff checklist", "todo", { type: "Task", priority: "Medium", storyPoints: 2, feature: "Runbooks", space: "Support" }),
    issue("OPS-24", "Clean unowned automation jobs", "todo", { type: "Task", assignee: "Unassigned", storyPoints: 0, feature: "Automation", space: "Internal Tools", staleDays: 15 }),
    issue("OPS-30", "Archive stale vendor board", "done", { type: "Task", priority: "Low", sprintId: "sprint-24", storyPoints: 1, feature: "Vendors", space: "Operations" }),
  ],
}
