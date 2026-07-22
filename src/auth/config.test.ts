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
  saveJiraAuthConfig,
  saveJiraWorkspaceConfig,
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
      await saveJiraWorkspaceConfig({ projectKey: "PROJ", projectName: "Product", boardId: "42", boardName: "Product Scrum", boardType: "scrum" }, env)

      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "new-token" }, env)

      const loaded = await loadLazyJiraConfig(env)
      expect(loaded?.jira?.apiToken).toBe("new-token")
      expect(loaded?.workspace).toEqual({ projectKey: "PROJ", projectName: "Product", boardId: "42", boardName: "Product Scrum", boardType: "scrum" })
    })
  })

  test("preserves auth when workspace context is updated", async () => {
    await withTempConfig(async (env) => {
      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }, env)

      await saveJiraWorkspaceConfig({ projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" }, env)

      const loaded = await loadLazyJiraConfig(env)
      expect(loaded?.jira).toEqual({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" })
      expect(loaded?.workspace).toEqual({ projectKey: "ENG", projectName: "Engineering", boardId: "7", boardName: "Engineering Kanban", boardType: "kanban" })
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
