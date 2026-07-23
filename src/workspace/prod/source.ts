import { loadJiraAuthConfig, type JiraAuthConfig } from "../../auth/config"
import { fetchAccessibleProjects, fetchProjectBoards } from "../../jira/client"
import { createLoadedWorkspace, type WorkspaceSelection, type WorkspaceSource } from "../types"

const prodPlaceholderStatuses = [
  { id: "todo", name: "To Do", category: "todo" as const, color: "#64748B" },
  { id: "in-progress", name: "In Progress", category: "in-progress" as const, color: "#38BDF8" },
  { id: "done", name: "Done", category: "done" as const, color: "#22C55E" },
]

const prodPlaceholderIssueTypes = [
  { id: "Task", name: "Task", color: "#3B82F6" },
  { id: "Bug", name: "Bug", color: "#EF4444" },
]

export function createProdWorkspaceSource(authLoader: () => Promise<JiraAuthConfig | undefined> = loadJiraAuthConfig): WorkspaceSource {
  return {
    env: "prod",
    async fetchProjects() {
      return fetchAccessibleProjects(await requireJiraAuth(authLoader))
    },
    async fetchBoards(projectKeyOrId) {
      return fetchProjectBoards(await requireJiraAuth(authLoader), projectKeyOrId)
    },
    async loadWorkspace(selection) {
      return createProdNotWiredWorkspace(selection)
    },
  }
}

function createProdNotWiredWorkspace(selection: WorkspaceSelection) {
  const notice = selection.project.key === "JIRA"
    ? "Prod runtime is waiting for a Jira project selection. Real tickets will stay empty until issue loading is wired."
    : "Prod Jira issue loading is not wired yet. Project and board selection are real; tickets are intentionally empty."
  return createLoadedWorkspace({
    ...selection,
    activeSprintId: "",
    sprints: [],
    statuses: prodPlaceholderStatuses,
    issueTypes: prodPlaceholderIssueTypes,
    issues: [],
    selectedIssueKey: "",
    notice,
  })
}

async function requireJiraAuth(authLoader: () => Promise<JiraAuthConfig | undefined>) {
  const auth = await authLoader()
  if (!auth) throw new Error("Jira credentials are required. Run `lazyjira auth login` or complete onboarding.")
  return auth
}
