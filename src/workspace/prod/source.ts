import { loadJiraAuthConfig, type JiraAuthConfig } from "../../auth/config"
import { fetchAccessibleProjects, fetchBoardConfiguration, fetchBoardSprints, fetchProjectBoards, fetchProjectStatuses, fetchSprintIssues, fetchStatusesByIds, type FetchLike, type JiraBoardConfiguration } from "../../jira/client"
import { normalizeBoardConfiguration, normalizeBoardSprints, normalizeProjectStatuses, normalizeSprintIssues } from "../../jira/normalize"
import { issueTypeColors, statusColorForCategory } from "../../state/metadata-colors"
import { createLoadedWorkspace, type WorkspaceSelection, type WorkspaceSource } from "../types"

const prodPlaceholderStatuses = [
  { id: "todo", name: "To Do", category: "todo" as const, color: statusColorForCategory("todo") },
  { id: "in-progress", name: "In Progress", category: "in-progress" as const, color: statusColorForCategory("in-progress") },
  { id: "done", name: "Done", category: "done" as const, color: statusColorForCategory("done") },
]

const prodPlaceholderIssueTypes = [
  { id: "Task", name: "Task", color: issueTypeColors.task },
  { id: "Bug", name: "Bug", color: issueTypeColors.bug },
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
      if (!selection.board.id) return createProdWorkspace(selection)
      const auth = await requireJiraAuth(authLoader)
      const [boardConfig, statusIssueTypes, sprints] = await Promise.all([
        fetchBoardConfiguration(auth, selection.board.id, fetchImpl),
        fetchProjectStatuses(auth, selection.project.key, fetchImpl),
        selection.board.type === "scrum" ? fetchBoardSprints(auth, selection.board.id, fetchImpl) : Promise.resolve([]),
      ])
      const statusLookup = normalizeProjectStatuses(statusIssueTypes)
      const missingStatusIds = boardStatusIds(boardConfig).filter((statusId) => !statusLookup.has(statusId))
      if (missingStatusIds.length) {
        const missingStatuses = normalizeProjectStatuses([{ statuses: await fetchStatusesByIds(auth, missingStatusIds, fetchImpl) }])
        for (const [statusId, status] of missingStatuses) statusLookup.set(statusId, status)
      }
      const metadata = normalizeBoardConfiguration(boardConfig, statusLookup)
      const normalizedSprints = normalizeBoardSprints(sprints)
      const activeSprintId = normalizedSprints.find((sprint) => sprint.state === "active")?.id
      const activeSprintIssues = activeSprintId ? normalizeSprintIssues(await fetchSprintIssues(auth, activeSprintId, fetchImpl), activeSprintId, metadata.statuses) : []
      return createProdWorkspace(selection, metadata, normalizedSprints, activeSprintIssues)
    },
  }
}

function createProdWorkspace(selection: WorkspaceSelection, metadata?: ReturnType<typeof normalizeBoardConfiguration>, sprints: ReturnType<typeof normalizeBoardSprints> = [], issues: ReturnType<typeof normalizeSprintIssues> = []) {
  const notice = selection.project.key === "JIRA"
    ? "Prod runtime is waiting for a Jira project selection. Real tickets will stay empty until issue loading is wired."
    : issues.length
      ? "Prod active sprint issues are loaded from Jira. Backlog and detail loading are next."
      : metadata?.statuses.length
        ? "Prod board metadata and sprints are loaded from Jira. Active sprint has no loaded issues yet."
      : "Prod Jira issue loading is not wired yet. Project and board selection are real; tickets are intentionally empty."
  return createLoadedWorkspace({
    ...selection,
    activeSprintId: sprints.find((sprint) => sprint.state === "active")?.id ?? sprints[0]?.id ?? "",
    sprints,
    statuses: metadata?.statuses.length ? metadata.statuses : prodPlaceholderStatuses,
    columns: metadata?.columns.length ? metadata.columns : undefined,
    issueTypes: prodPlaceholderIssueTypes,
    issues,
    selectedIssueKey: "",
    notice,
  })
}

async function requireJiraAuth(authLoader: () => Promise<JiraAuthConfig | undefined>) {
  const auth = await authLoader()
  if (!auth) throw new Error("Jira credentials are required. Run `lazyjira auth login` or complete onboarding.")
  return auth
}

function boardStatusIds(config: JiraBoardConfiguration) {
  const ids: string[] = []
  for (const column of config.columnConfig?.columns ?? []) {
    for (const status of column.statuses ?? []) {
      if (status.id && !ids.includes(status.id)) ids.push(status.id)
    }
  }
  return ids
}
