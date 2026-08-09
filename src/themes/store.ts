import { mkdir, readFile, readdir, writeFile, copyFile } from "node:fs/promises"
import { join } from "node:path"
import { lazyJiraConfigPath, saveThemeIdConfig } from "../auth/config"
import { builtInThemes, defaultThemeId, parseThemeFile, resolveTheme, themeStarter, titleFromId, type ResolvedTheme } from "./catalog"
export type { AvailableTheme } from "./catalog"
import type { AvailableTheme } from "./catalog"

export type ThemeCatalog = { themes: AvailableTheme[]; errors: string[] }

export function themesDirectory(env: Record<string, string | undefined> = process.env) {
  return join(lazyJiraConfigPath(env), "..", "themes")
}

export async function loadThemeCatalog(env: Record<string, string | undefined> = process.env): Promise<ThemeCatalog> {
  let files: string[] = []
  try {
    files = await readdir(themesDirectory(env))
  } catch (error) {
    if (!isMissingFileError(error)) throw error
  }
  const themes: AvailableTheme[] = builtInThemes.map((theme) => ({ ...theme, source: "built-in" }))
  const errors: string[] = []
  for (const file of files.filter((candidate) => candidate.endsWith(".json")).sort()) {
    const path = join(themesDirectory(env), file)
    try {
      const parsed = parseThemeFile(await readFile(path, "utf8"))
      if (themes.some((theme) => theme.id === parsed.id)) throw new Error(`Theme id ${parsed.id} conflicts with an existing theme.`)
      themes.push({ ...resolveTheme(parsed), source: "user", path })
    } catch (error) {
      errors.push(`${file}: ${error instanceof Error ? error.message : "Unknown error."}`)
    }
  }
  return { themes, errors }
}

export async function loadSelectedTheme(themeId: string | undefined, env: Record<string, string | undefined> = process.env) {
  const catalog = await loadThemeCatalog(env)
  const preferredId = themeId ?? defaultThemeId
  const selected = catalog.themes.find((theme) => theme.id === preferredId) ?? catalog.themes.find((theme) => theme.id === defaultThemeId)!
  return { ...catalog, selected, fellBack: selected.id !== preferredId }
}

export async function installTheme(sourcePath: string, env: Record<string, string | undefined> = process.env) {
  const parsed = parseThemeFile(await readFile(sourcePath, "utf8"))
  if (builtInThemes.some((theme) => theme.id === parsed.id)) throw new Error(`Theme id ${parsed.id} is reserved by a built-in theme.`)
  const dir = themesDirectory(env)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const destination = join(dir, `${parsed.id}.json`)
  await assertThemeDoesNotExist(destination)
  await copyFile(sourcePath, destination)
  return { theme: resolveTheme(parsed), destination }
}

export async function initializeTheme(id: string, env: Record<string, string | undefined> = process.env) {
  const filename = `${id}.json`
  parseThemeFile(themeStarter(id))
  const dir = themesDirectory(env)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  const destination = join(dir, filename)
  await assertThemeDoesNotExist(destination)
  await writeFile(destination, themeStarter(id, titleFromId(id)), { mode: 0o600 })
  return destination
}

export async function selectTheme(themeId: string, env: Record<string, string | undefined> = process.env) {
  const catalog = await loadThemeCatalog(env)
  if (!catalog.themes.some((theme) => theme.id === themeId)) throw new Error(`Unknown theme: ${themeId}`)
  await saveThemeIdConfig(themeId, env)
}

async function assertThemeDoesNotExist(path: string) {
  try {
    await readFile(path)
    throw new Error(`Theme already exists: ${path}`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Theme already exists:")) throw error
    if (!isMissingFileError(error)) throw error
  }
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
