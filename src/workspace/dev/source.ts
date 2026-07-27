import type { WorkspaceSelection, WorkspaceSource } from "../types"
import { devBoardsByProjectKey, devProjects, loadDevWorkspaceFixture } from "./fixtures"
import { backlogIssuePageSourceId, boardIssuePageSourceId, remoteSearchIssuePageSourceId, sprintIssuePageSourceId } from "../../state/issue-pages"

export function createDevWorkspaceSource(): WorkspaceSource {
  return {
    env: "dev",
    async fetchProjects() {
      return [...devProjects]
    },
    async fetchBoards(projectKeyOrId) {
      const project = devProjects.find((candidate) => candidate.key === projectKeyOrId || candidate.id === projectKeyOrId)
      return [...(devBoardsByProjectKey[project?.key ?? projectKeyOrId] ?? [])]
    },
    async loadWorkspace(selection: WorkspaceSelection) {
      return loadDevWorkspaceFixture(selection.project.key)
    },
    async loadIssueDetail(issueKey, context) {
      const issue = context.existingIssue ?? loadDevWorkspaceFixture(context.project.key).issues[issueKey]
      if (!issue) throw new Error(`Dev issue ${issueKey} was not found`)
      return { issue }
    },
    async loadIssuePage(sourceId, context) {
      const issues = Object.values(loadDevWorkspaceFixture(context.project.key).issues).filter((issue) => issueInSource(issue.sprintId, sourceId))
      const startAt = context.pageState.startAt
      const maxResults = context.pageState.maxResults
      const items = issues.slice(startAt, startAt + maxResults)
      const nextStartAt = startAt + items.length
      return {
        sourceId,
        issues: items,
        pageState: { sourceId, startAt: nextStartAt, maxResults, total: issues.length, isLast: nextStartAt >= issues.length, loading: false },
      }
    },
    async searchIssues(query, context) {
      const normalized = query.trim().toLowerCase()
      const issues = Object.values(loadDevWorkspaceFixture(context.project.key).issues).filter((issue) => `${issue.key} ${issue.title} ${issue.description}`.toLowerCase().includes(normalized))
      const startAt = context.pageState.startAt
      const maxResults = context.pageState.maxResults
      const items = issues.slice(startAt, startAt + maxResults)
      const nextStartAt = startAt + items.length
      return {
        query,
        issues: items,
        pageState: { sourceId: remoteSearchIssuePageSourceId, startAt: nextStartAt, maxResults, total: issues.length, isLast: nextStartAt >= issues.length, loading: false },
      }
    },
    async postIssueComment() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async updateIssue() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async transitionIssue() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async moveIssueToSprint() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async updateDiscoveredField() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async updateIssueType() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async deleteIssue() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async createIssue() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async rankIssue() {
      throw new Error("Remote Jira writes are unavailable in dev runtime")
    },
    async loadUserPicker(fieldId, issueKey, projectKey, query) {
      const members = [...new Set(Object.values(loadDevWorkspaceFixture(projectKey).issues).flatMap((issue) => [issue.assignee, issue.reporter]).filter((name) => name && name !== "Unassigned"))]
      const normalizedQuery = query.trim().toLowerCase()
      return members.filter((displayName) => !normalizedQuery || displayName.toLowerCase().includes(normalizedQuery)).map((displayName) => ({ accountId: displayName, displayName }))
    },
  }
}

function issueInSource(sprintId: string | undefined, sourceId: string) {
  if (sourceId === boardIssuePageSourceId) return true
  if (sourceId === backlogIssuePageSourceId) return !sprintId
  if (sourceId.startsWith("sprint:")) return sourceId === sprintIssuePageSourceId(sprintId ?? "")
  return false
}
