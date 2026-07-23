import type { JiraBoardOption, JiraProjectOption } from "./client"

export const mockJiraProjects: JiraProjectOption[] = [
  { id: "10000", key: "PROJ", name: "Product Platform" },
  { id: "10001", key: "MOB", name: "Mobile Apps" },
  { id: "10002", key: "OPS", name: "Internal Operations" },
]

const mockBoardsByProjectKey: Record<string, JiraBoardOption[]> = {
  PROJ: [{ id: "43", name: "Product Kanban", type: "kanban" }],
  MOB: [{ id: "52", name: "Mobile Kanban", type: "kanban" }],
  OPS: [{ id: "77", name: "Ops Kanban", type: "kanban" }],
}

export function mockAccessibleProjects() {
  return [...mockJiraProjects]
}

export function mockProjectBoards(projectKeyOrId: string) {
  const project = mockJiraProjects.find((candidate) => candidate.key === projectKeyOrId || candidate.id === projectKeyOrId)
  return [...(mockBoardsByProjectKey[project?.key ?? projectKeyOrId] ?? [])]
}
