import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { homedir } from "node:os"

export type JiraAuthConfig = {
  baseUrl: string
  email: string
  apiToken: string
}

export type JiraAuthSummary = {
  baseUrl: string
  email: string
  hasApiToken: boolean
}

export type JiraWorkspaceConfig = {
  projectKey: string
  projectName: string
  boardId: string
  boardName: string
  boardType: "scrum" | "kanban"
}

export type LazyJiraConfigFile = {
  jira?: JiraAuthConfig
  workspace?: JiraWorkspaceConfig
}

export function lazyJiraConfigPath(env: Record<string, string | undefined> = process.env) {
  if (env.LAZYJIRA_CONFIG) return env.LAZYJIRA_CONFIG
  const configHome = env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return join(configHome, "lazyjira", "config.json")
}

export async function loadJiraAuthConfig(env: Record<string, string | undefined> = process.env): Promise<JiraAuthConfig | undefined> {
  const envAuth = jiraAuthFromEnv(env)
  if (envAuth) return envAuth

  const config = await loadLazyJiraConfig(env)
  if (!config?.jira) return undefined
  const apiToken = env.LAZYJIRA_API_TOKEN || env.JIRA_API_TOKEN || config.jira.apiToken
  return normalizeJiraAuthConfig({ ...config.jira, apiToken })
}

export async function loadLazyJiraConfig(env: Record<string, string | undefined> = process.env): Promise<LazyJiraConfigFile | undefined> {
  const path = lazyJiraConfigPath(env)
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    if (isNoEntry(error)) return undefined
    if (error instanceof SyntaxError) throw new Error(`Invalid lazyjira config JSON at ${path}`)
    throw error
  }
  return parseConfigFile(parsed, path)
}

export async function saveJiraAuthConfig(auth: JiraAuthConfig, env: Record<string, string | undefined> = process.env) {
  const current = await loadExistingConfigForSave(env)
  return saveLazyJiraConfig({ ...current, jira: normalizeJiraAuthConfig(auth) }, env)
}

export async function saveJiraWorkspaceConfig(workspace: JiraWorkspaceConfig, env: Record<string, string | undefined> = process.env) {
  const current = await loadExistingConfigForSave(env)
  return saveLazyJiraConfig({ ...current, workspace: normalizeJiraWorkspaceConfig(workspace) }, env)
}

export async function saveLazyJiraConfig(config: LazyJiraConfigFile, env: Record<string, string | undefined> = process.env) {
  const path = lazyJiraConfigPath(env)
  const normalized: LazyJiraConfigFile = {
    jira: config.jira ? normalizeJiraAuthConfig(config.jira) : undefined,
    workspace: config.workspace ? normalizeJiraWorkspaceConfig(config.workspace) : undefined,
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, `${JSON.stringify(dropUndefined(normalized), null, 2)}\n`, { mode: 0o600 })
  await chmod(path, 0o600)
  return path
}

export async function removeJiraAuthConfig(env: Record<string, string | undefined> = process.env) {
  try {
    await unlink(lazyJiraConfigPath(env))
    return true
  } catch (error) {
    if (isNoEntry(error)) return false
    throw error
  }
}

export function jiraAuthSummary(auth: JiraAuthConfig): JiraAuthSummary {
  return { baseUrl: auth.baseUrl, email: auth.email, hasApiToken: !!auth.apiToken }
}

export function jiraBasicAuthHeader(auth: JiraAuthConfig) {
  return `Basic ${Buffer.from(`${auth.email}:${auth.apiToken}`).toString("base64")}`
}

export function normalizeJiraAuthConfig(auth: JiraAuthConfig): JiraAuthConfig {
  const baseUrl = normalizeBaseUrl(auth.baseUrl)
  const email = auth.email.trim()
  const apiToken = auth.apiToken.trim()
  if (!email) throw new Error("Jira email is required")
  if (!apiToken) throw new Error("Jira API token is required")
  return { baseUrl, email, apiToken }
}

export function normalizeJiraWorkspaceConfig(workspace: JiraWorkspaceConfig): JiraWorkspaceConfig {
  const projectKey = workspace.projectKey.trim()
  const projectName = workspace.projectName.trim()
  const boardId = workspace.boardId.trim()
  const boardName = workspace.boardName.trim()
  if (!projectKey) throw new Error("Jira project key is required")
  if (!projectName) throw new Error("Jira project name is required")
  if (!boardId) throw new Error("Jira board ID is required")
  if (!boardName) throw new Error("Jira board name is required")
  return { projectKey, projectName, boardId, boardName, boardType: workspace.boardType === "kanban" ? "kanban" : "scrum" }
}

export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) throw new Error("Jira site URL is required")
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`
  const url = new URL(candidate)
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Jira site URL must start with http:// or https://")
  url.hash = ""
  url.search = ""
  url.pathname = url.pathname.replace(/\/+$/, "")
  return url.toString().replace(/\/+$/, "")
}

function jiraAuthFromEnv(env: Record<string, string | undefined>): JiraAuthConfig | undefined {
  const baseUrl = env.LAZYJIRA_URL || env.JIRA_URL
  const email = env.LAZYJIRA_EMAIL || env.JIRA_EMAIL
  const apiToken = env.LAZYJIRA_API_TOKEN || env.JIRA_API_TOKEN
  if (!baseUrl || !email || !apiToken) return undefined
  return normalizeJiraAuthConfig({ baseUrl, email, apiToken })
}

function parseConfigFile(value: unknown, path: string): LazyJiraConfigFile {
  if (!isRecord(value)) throw new Error(`Invalid lazyjira config shape at ${path}`)
  if (typeof value.baseUrl === "string" || typeof value.email === "string" || typeof value.apiToken === "string") {
    return { jira: parseJiraAuth(value, path) }
  }
  return {
    jira: value.jira === undefined ? undefined : parseJiraAuth(value.jira, path),
    workspace: value.workspace === undefined ? undefined : parseJiraWorkspace(value.workspace, path),
  }
}

async function loadExistingConfigForSave(env: Record<string, string | undefined>) {
  try {
    return await loadLazyJiraConfig(env)
  } catch (error) {
    if (isInvalidConfigError(error)) return undefined
    throw error
  }
}

function isInvalidConfigError(error: unknown) {
  return error instanceof Error && error.message.startsWith("Invalid ")
}

function parseJiraAuth(value: unknown, path: string): JiraAuthConfig {
  if (!isRecord(value) || typeof value.baseUrl !== "string" || typeof value.email !== "string" || typeof value.apiToken !== "string") {
    throw new Error(`Invalid Jira auth config at ${path}`)
  }
  return normalizeJiraAuthConfig({ baseUrl: value.baseUrl, email: value.email, apiToken: value.apiToken })
}

function parseJiraWorkspace(value: unknown, path: string): JiraWorkspaceConfig {
  if (!isRecord(value) || typeof value.projectKey !== "string" || typeof value.projectName !== "string" || typeof value.boardId !== "string" || typeof value.boardName !== "string") {
    throw new Error(`Invalid Jira workspace config at ${path}`)
  }
  const boardType = value.boardType === "kanban" ? "kanban" : "scrum"
  return normalizeJiraWorkspaceConfig({ projectKey: value.projectKey, projectName: value.projectName, boardId: value.boardId, boardName: value.boardName, boardType })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNoEntry(error: unknown) {
  return isRecord(error) && error.code === "ENOENT"
}

function dropUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter((entry) => entry[1] !== undefined))
}
