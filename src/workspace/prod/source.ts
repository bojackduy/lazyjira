import { loadJiraAuthConfig, type JiraAuthConfig } from "../../auth/config"
import { fetchAccessibleProjects, fetchBoardConfiguration, fetchBoardSprints, fetchProjectBoards, type FetchLike } from "../../jira/client"
import { normalizeBoardConfiguration, normalizeBoardSprints } from "../../jira/normalize"
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

export function createProdWorkspaceSource(authLoader: () => Promise<JiraAuthConfig | undefined> = loadJiraAuthConfig, fetchImpl: FetchLike = fetch): WorkspaceSource {
  return {
    env: "prod",
    async fetchProjects() {
      return fetchAccessibleProjects(await requireJiraAuth(authLoader), fetchImpl)
    },
    async fetchBoards(projectKeyOrId) {
      return fetchProjectBoards(await requireJiraAuth(authLoader), projectKeyOrId, fetchImpl)
    },
    async loadWorkspace(selection) {
      if (!selection.board.id) return createProdNotWiredWorkspace(selection)
      const auth = await requireJiraAuth(authLoader)
      const [boardConfig, sprints] = await Promise.all([
        fetchBoardConfiguration(auth, selection.board.id, fetchImpl),
        fetchBoardSprints(auth, selection.board.id, fetchImpl),
      ])
      return createProdNotWiredWorkspace(selection, normalizeBoardConfiguration(boardConfig), normalizeBoardSprints(sprints))
    },
  }
}

function createProdNotWiredWorkspace(selection: WorkspaceSelection, metadata?: ReturnType<typeof normalizeBoardConfiguration>, sprints: ReturnType<typeof normalizeBoardSprints> = []) {
  const notice = selection.project.key === "JIRA"
    ? "Prod runtime is waiting for a Jira project selection. Real tickets will stay empty until issue loading is wired."
    : metadata?.statuses.length
      ? "Prod board metadata and sprints are loaded from Jira. Issue loading is next, so tickets are intentionally empty."
      : "Prod Jira issue loading is not wired yet. Project and board selection are real; tickets are intentionally empty."
  return createLoadedWorkspace({
    ...selection,
    activeSprintId: sprints.find((sprint) => sprint.state === "active")?.id ?? sprints[0]?.id ?? "",
    sprints,
    statuses: metadata?.statuses.length ? metadata.statuses : prodPlaceholderStatuses,
    columns: metadata?.columns.length ? metadata.columns : undefined,
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
