import { loadJiraAuthConfig, type JiraAuthConfig } from "../../auth/config"
import { fetchAccessibleProjects, fetchBoardBacklogIssues, fetchBoardConfiguration, fetchBoardSprints, fetchJiraFields, fetchProjectBoards, fetchProjectStatuses, fetchSprintIssues, fetchStatusesByIds, type FetchLike, type JiraBoardConfiguration } from "../../jira/client"
import { discoverJiraIssueFieldIds, issueCustomFieldIds, normalizeBoardConfiguration, normalizeBoardSprints, normalizeJiraIssues, normalizeProjectStatuses, normalizeSprintIssues } from "../../jira/normalize"
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
      const [boardConfig, statusIssueTypes, sprints, jiraFields] = await Promise.all([
        fetchBoardConfiguration(auth, selection.board.id, fetchImpl),
        fetchProjectStatuses(auth, selection.project.key, fetchImpl),
        selection.board.type === "scrum" ? fetchBoardSprints(auth, selection.board.id, fetchImpl) : Promise.resolve([]),
        fetchJiraFields(auth, fetchImpl),
      ])
      const statusLookup = normalizeProjectStatuses(statusIssueTypes)
      const missingStatusIds = boardStatusIds(boardConfig).filter((statusId) => !statusLookup.has(statusId))
      if (missingStatusIds.length) {
        const missingStatuses = normalizeProjectStatuses([{ statuses: await fetchStatusesByIds(auth, missingStatusIds, fetchImpl) }])
        for (const [statusId, status] of missingStatuses) statusLookup.set(statusId, status)
      }
      const metadata = normalizeBoardConfiguration(boardConfig, statusLookup)
      const normalizedSprints = normalizeBoardSprints(sprints)
      const fieldIds = discoverJiraIssueFieldIds(jiraFields)
      const customFields = issueCustomFieldIds(fieldIds)
      const activeSprints = normalizedSprints.filter((sprint) => sprint.state === "active")
      const [activeSprintIssuePages, backlogIssues] = await Promise.all([
        Promise.all(activeSprints.map(async (sprint) => normalizeSprintIssues(await fetchSprintIssues(auth, sprint.id, fetchImpl, customFields), sprint.id, metadata.statuses, fieldIds))),
        selection.board.type === "scrum" ? fetchBoardBacklogIssues(auth, selection.board.id, fetchImpl, customFields) : Promise.resolve([]),
      ])
      const issues = uniqueIssues([
        ...activeSprintIssuePages.flat(),
        ...normalizeJiraIssues(backlogIssues, metadata.statuses, { fieldIds }),
      ])
      return createProdWorkspace(selection, metadata, normalizedSprints, issues)
    },
  }
}

function createProdWorkspace(selection: WorkspaceSelection, metadata?: ReturnType<typeof normalizeBoardConfiguration>, sprints: ReturnType<typeof normalizeBoardSprints> = [], issues: ReturnType<typeof normalizeSprintIssues> = []) {
  const notice = selection.project.key === "JIRA"
    ? "Prod runtime is waiting for a Jira project selection. Real tickets will stay empty until issue loading is wired."
    : issues.length
      ? "Prod active sprint and bounded backlog issues are loaded from Jira. Detail loading is next."
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

function uniqueIssues<T extends { key: string }>(issues: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const issue of issues) {
    if (!byKey.has(issue.key)) byKey.set(issue.key, issue)
  }
  return [...byKey.values()]
}
