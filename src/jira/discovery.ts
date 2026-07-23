import { loadJiraAuthConfig, type JiraAuthConfig } from "../auth/config"
import { fetchAccessibleProjects, fetchProjectBoards, type JiraBoardOption, type JiraProjectOption } from "./client"
import { mockAccessibleProjects, mockProjectBoards } from "./mock"

export type JiraDiscoveryMode = "jira" | "mock"

export type JiraDiscoverySource = {
  mode: JiraDiscoveryMode
  fetchProjects: () => Promise<JiraProjectOption[]>
  fetchBoards: (projectKeyOrId: string) => Promise<JiraBoardOption[]>
}

export function createMockDiscoverySource(): JiraDiscoverySource {
  return {
    mode: "mock",
    async fetchProjects() {
      return mockAccessibleProjects()
    },
    async fetchBoards(projectKeyOrId) {
      return mockProjectBoards(projectKeyOrId)
    },
  }
}

export function createApiDiscoverySource(authLoader: () => Promise<JiraAuthConfig | undefined> = loadJiraAuthConfig): JiraDiscoverySource {
  return {
    mode: "jira",
    async fetchProjects() {
      return fetchAccessibleProjects(await requireJiraAuth(authLoader))
    },
    async fetchBoards(projectKeyOrId) {
      return fetchProjectBoards(await requireJiraAuth(authLoader), projectKeyOrId)
    },
  }
}

async function requireJiraAuth(authLoader: () => Promise<JiraAuthConfig | undefined>) {
  const auth = await authLoader()
  if (!auth) throw new Error("Jira credentials are required. Run `lazyjira auth login` or complete onboarding.")
  return auth
}
