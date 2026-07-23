import { describe, expect, test } from "bun:test"
import { createApiDiscoverySource, createMockDiscoverySource } from "./discovery"

describe("Jira discovery source", () => {
  test("uses mock fixtures in mock mode", async () => {
    const source = createMockDiscoverySource()

    expect(source.mode).toBe("mock")
    expect((await source.fetchProjects()).map((project) => project.key)).toEqual(["PROJ", "MOB", "OPS"])
    expect(await source.fetchBoards("PROJ")).toEqual([{ id: "43", name: "Product Kanban", type: "kanban" }])
  })

  test("requires auth in Jira mode", async () => {
    const source = createApiDiscoverySource(async () => undefined)

    expect(source.mode).toBe("jira")
    await expect(source.fetchProjects()).rejects.toThrow("Jira credentials are required")
  })
})
