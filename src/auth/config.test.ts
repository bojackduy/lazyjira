import { describe, expect, test } from "bun:test"
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  jiraBasicAuthHeader,
  lazyJiraConfigPath,
  loadLazyJiraConfig,
  loadJiraAuthConfig,
  removeJiraAuthConfig,
  saveDevWorkspaceConfig,
  saveJiraAuthConfig,
  saveProdWorkspaceConfig,
} from "./config"

describe("Jira auth config", () => {
  test("uses LAZYJIRA_CONFIG when provided", () => {
    expect(lazyJiraConfigPath({ LAZYJIRA_CONFIG: "/tmp/custom-lazyjira.json" })).toBe("/tmp/custom-lazyjira.json")
  })

  test("saves and loads normalized credentials with user-only file permissions", async () => {
    await withTempConfig(async (env, path) => {
      await saveJiraAuthConfig({ baseUrl: "example.atlassian.net/", email: " duy@example.com ", apiToken: " token " }, env)

      const loaded = await loadJiraAuthConfig(env)
      const mode = (await stat(path)).mode & 0o777

      expect(loaded).toEqual({ baseUrl: "https://example.atlassian.net", email: "duy@example.com", apiToken: "token" })
      expect(mode).toBe(0o600)
    })
  })

  test("allows env-only credentials", async () => {
    const loaded = await loadJiraAuthConfig({
      LAZYJIRA_URL: "https://team.atlassian.net",
      LAZYJIRA_EMAIL: "duy@example.com",
      LAZYJIRA_API_TOKEN: "env-token",
    })

    expect(loaded).toEqual({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "env-token" })
  })

  test("lets LAZYJIRA_API_TOKEN override the saved token", async () => {
    await withTempConfig(async (env) => {
      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "file-token" }, env)

      const loaded = await loadJiraAuthConfig({ ...env, LAZYJIRA_API_TOKEN: "env-token" })

      expect(loaded?.apiToken).toBe("env-token")
    })
  })

  test("loads legacy flat credential files", async () => {
    await withTempConfig(async (env, path) => {
      await writeFile(path, JSON.stringify({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }))

      const loaded = await loadJiraAuthConfig(env)

      expect(loaded).toEqual({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" })
    })
  })

  test("can overwrite invalid config when saving credentials", async () => {
    await withTempConfig(async (env, path) => {
      await writeFile(path, "not json")

      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }, env)

      const loaded = await loadJiraAuthConfig(env)
      expect(loaded).toEqual({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" })
    })
  })

  test("preserves workspace context when auth is updated", async () => {
    await withTempConfig(async (env) => {
      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "old-token" }, env)
      await saveProdWorkspaceConfig({ projectKey: "PROJ", projectName: "Product", boardId: "42", boardName: "Product Kanban", boardType: "kanban" }, env)

      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "new-token" }, env)

      const loaded = await loadLazyJiraConfig(env)
      expect(loaded?.jira?.apiToken).toBe("new-token")
      expect(loaded?.prodWorkspace).toEqual({ projectKey: "PROJ", projectName: "Product", boardId: "42", boardName: "Product Kanban", boardType: "kanban" })
    })
  })

  test("preserves auth when workspace context is updated", async () => {
    await withTempConfig(async (env) => {
      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }, env)

      await saveProdWorkspaceConfig({ projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" }, env)

      const loaded = await loadLazyJiraConfig(env)
      expect(loaded?.jira).toEqual({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" })
      expect(loaded?.prodWorkspace).toEqual({ projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" })
      expect(loaded?.prodRecentWorkspaces).toEqual([{ projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" }])
    })
  })

  test("keeps most recent prod workspaces first without duplicates", async () => {
    await withTempConfig(async (env) => {
      await saveProdWorkspaceConfig({ projectKey: "PROJ", projectName: "Product", boardId: "42", boardName: "Product Kanban", boardType: "kanban" }, env)
      await saveProdWorkspaceConfig({ projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" }, env)
      await saveProdWorkspaceConfig({ projectKey: "PROJ", projectName: "Product", boardId: "42", boardName: "Product Kanban", boardType: "kanban" }, env)

      const loaded = await loadLazyJiraConfig(env)

      expect(loaded?.prodWorkspace?.projectKey).toBe("PROJ")
      expect(loaded?.prodRecentWorkspaces?.map((workspace) => `${workspace.projectKey}:${workspace.boardId}`)).toEqual(["PROJ:42", "ENG:7"])
    })
  })

  test("keeps dev and prod workspace contexts separate", async () => {
    await withTempConfig(async (env) => {
      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }, env)
      await saveDevWorkspaceConfig({ projectKey: "DEV", projectName: "Dev", boardId: "dev-1", boardName: "Dev Kanban", boardType: "kanban" }, env)
      await saveProdWorkspaceConfig({ projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" }, env)

      const loaded = await loadLazyJiraConfig(env)
      expect(loaded?.jira?.apiToken).toBe("token")
      expect(loaded?.devWorkspace).toEqual({ projectKey: "DEV", projectName: "Dev", boardId: "dev-1", boardName: "Dev Kanban", boardType: "kanban" })
      expect(loaded?.prodWorkspace).toEqual({ projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" })
      expect(loaded?.devRecentWorkspaces?.map((workspace) => workspace.projectKey)).toEqual(["DEV"])
      expect(loaded?.prodRecentWorkspaces?.map((workspace) => workspace.projectKey)).toEqual(["ENG"])
    })
  })

  test("migrates legacy workspace keys into explicit dev and prod keys", async () => {
    await withTempConfig(async (env, path) => {
      await writeFile(path, JSON.stringify({
        workspace: { projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" },
        demoWorkspace: { projectKey: "DEV", projectName: "Dev", boardId: "dev-1", boardName: "Dev Kanban", boardType: "kanban" },
      }))

      const loaded = await loadLazyJiraConfig(env)
      expect(loaded?.prodWorkspace?.projectKey).toBe("ENG")
      expect(loaded?.devWorkspace?.projectKey).toBe("DEV")
      expect(loaded?.prodRecentWorkspaces?.map((workspace) => workspace.projectKey)).toEqual(["ENG"])
      expect(loaded?.devRecentWorkspaces?.map((workspace) => workspace.projectKey)).toEqual(["DEV"])
    })
  })

  test("normalizes legacy persisted board routes in the real workspace config shape", async () => {
    await withTempConfig(async (env, path) => {
      await writeFile(path, JSON.stringify({
        prodWorkspace: { projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Delivery", boardType: "scrum", route: "active-sprint" },
        devWorkspace: { projectKey: "DEV", projectName: "Dev", boardId: "dev-1", boardName: "Flow", boardType: "kanban", route: "kanban" },
      }))

      const loaded = await loadLazyJiraConfig(env)

      expect(loaded?.prodWorkspace?.route).toBe("board")
      expect(loaded?.devWorkspace?.route).toBe("board")
      expect(loaded?.prodRecentWorkspaces?.[0]?.route).toBe("board")
      expect(loaded?.devRecentWorkspaces?.[0]?.route).toBe("board")
    })
  })

  test("removes saved credentials", async () => {
    await withTempConfig(async (env) => {
      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }, env)

      expect(await removeJiraAuthConfig(env)).toBe(true)
      expect(await loadJiraAuthConfig(env)).toBeUndefined()
      expect(await removeJiraAuthConfig(env)).toBe(false)
    })
  })

  test("builds the Jira basic auth header", () => {
    expect(jiraBasicAuthHeader({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" })).toBe("Basic ZHV5QGV4YW1wbGUuY29tOnRva2Vu")
  })
})

async function withTempConfig(run: (env: Record<string, string | undefined>, path: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "lazyjira-auth-"))
  const path = join(dir, "config.json")
  try {
    await run({ LAZYJIRA_CONFIG: path }, path)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
