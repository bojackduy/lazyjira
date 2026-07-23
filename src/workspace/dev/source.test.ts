import { describe, expect, test } from "bun:test"
import { createDevWorkspaceSource } from "./source"

describe("dev workspace source", () => {
  test("loads different fixture tickets per project", async () => {
    const source = createDevWorkspaceSource()
    const projects = await source.fetchProjects()

    const product = await source.loadWorkspace({ project: projects[0]!, board: (await source.fetchBoards(projects[0]!.key))[0]! })
    const mobile = await source.loadWorkspace({ project: projects[1]!, board: (await source.fetchBoards(projects[1]!.key))[0]! })
    const ops = await source.loadWorkspace({ project: projects[2]!, board: (await source.fetchBoards(projects[2]!.key))[0]! })

    expect(Object.keys(product.issues).some((key) => key.startsWith("PROJ-"))).toBe(true)
    expect(Object.keys(mobile.issues).every((key) => key.startsWith("MOB-"))).toBe(true)
    expect(Object.keys(ops.issues).every((key) => key.startsWith("OPS-"))).toBe(true)
  })
})
