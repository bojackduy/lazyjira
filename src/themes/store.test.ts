import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { loadLazyJiraConfig, saveJiraAuthConfig } from "../auth/config"
import { initializeTheme, installTheme, loadSelectedTheme, loadThemeCatalog, selectTheme, themesDirectory } from "./store"
import { parseThemeFile } from "./catalog"

const customTheme = JSON.stringify({
  version: 1,
  id: "my-theme",
  name: "My Theme",
  extends: "midnight",
  colors: { background: "#000000", accent: "#ff00ff" },
  syntax: { keyword: "#ff0000" },
}, null, 2)

describe("theme store", () => {
  test("lists built-ins and loads user themes, ignoring invalid files", async () => {
    await withTempThemes(async (env, dir) => {
      await writeFile(join(dir, "my-theme.json"), customTheme)
      await writeFile(join(dir, "broken.json"), "{ not json")

      const catalog = await loadThemeCatalog(env)

      expect(catalog.themes.map((theme) => theme.id)).toContain("my-theme")
      expect(catalog.themes.find((theme) => theme.id === "my-theme")?.source).toBe("user")
      expect(catalog.errors.length).toBe(1)
    })
  })

  test("installs and selects a user theme, persisting the theme id", async () => {
    await withTempThemes(async (env, dir) => {
      const source = join(dirname(dir), "source.json")
      await writeFile(source, customTheme)
      await saveJiraAuthConfig({ baseUrl: "https://team.atlassian.net", email: "duy@example.com", apiToken: "token" }, env)

      const installed = await installTheme(source, env)
      await selectTheme("my-theme", env)

      const selected = await loadSelectedTheme("my-theme", env)
      expect(installed.theme.name).toBe("My Theme")
      expect(await readFile(installed.destination, "utf8")).toBe(customTheme)
      expect(selected.selected.id).toBe("my-theme")
      expect((await loadLazyJiraConfig(env))?.themeId).toBe("my-theme")
    })
  })

  test("falls back to the default theme for unknown ids", async () => {
    const selected = await loadSelectedTheme("does-not-exist")
    expect(selected.selected.id).toBe("midnight")
    expect(selected.fellBack).toBe(true)
  })

  test("initializes an editable validated starter", async () => {
    await withTempThemes(async (env, dir) => {
      const destination = await initializeTheme("my-theme", env)
      expect(parseThemeFile(await readFile(destination, "utf8"))).toMatchObject({ id: "my-theme", extends: "midnight" })
      await expect(initializeTheme("my-theme", env)).rejects.toThrow("Theme already exists")
    })
  })

  test("points at the config-adjacent themes directory", async () => {
    const env = { LAZYJIRA_CONFIG: "/tmp/lazyjira-custom/config.json" }
    expect(themesDirectory(env)).toBe("/tmp/lazyjira-custom/themes")
  })
})

async function withTempThemes(run: (env: Record<string, string>, dir: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "lazyjira-theme-"))
  const dir = join(root, "themes")
  const env = { LAZYJIRA_CONFIG: join(root, "config.json") }
  try {
    await mkdir(dir, { recursive: true })
    await run(env, dir)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}