import { describe, expect, test } from "bun:test"
import { mockAccessibleProjects, mockProjectBoards } from "./mock"

describe("mock Jira discovery", () => {
  test("provides projects and boards for demo project selection", () => {
    const projects = mockAccessibleProjects()

    expect(projects.map((project) => project.key)).toEqual(["PROJ", "MOB", "OPS"])
    expect(mockProjectBoards("PROJ")).toEqual([
      { id: "42", name: "Product Scrum", type: "scrum" },
      { id: "43", name: "Product Kanban", type: "kanban" },
    ])
    expect(mockProjectBoards("10002")).toEqual([{ id: "77", name: "Ops Kanban", type: "kanban" }])
  })
})
