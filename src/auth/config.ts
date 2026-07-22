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

type LazyJiraConfigFile = {
  jira: JiraAuthConfig
}

export function lazyJiraConfigPath(env: Record<string, string | undefined> = process.env) {
  if (env.LAZYJIRA_CONFIG) return env.LAZYJIRA_CONFIG
  const configHome = env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return join(configHome, "lazyjira", "config.json")
}

export async function loadJiraAuthConfig(env: Record<string, string | undefined> = process.env): Promise<JiraAuthConfig | undefined> {
  const envAuth = jiraAuthFromEnv(env)
  if (envAuth) return envAuth

  const path = lazyJiraConfigPath(env)
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(path, "utf8"))
  } catch (error) {
    if (isNoEntry(error)) return undefined
    if (error instanceof SyntaxError) throw new Error(`Invalid lazyjira config JSON at ${path}`)
    throw error
  }

  const config = parseConfigFile(parsed, path)
  const apiToken = env.LAZYJIRA_API_TOKEN || env.JIRA_API_TOKEN || config.jira.apiToken
  return normalizeJiraAuthConfig({ ...config.jira, apiToken })
}

export async function saveJiraAuthConfig(auth: JiraAuthConfig, env: Record<string, string | undefined> = process.env) {
  const path = lazyJiraConfigPath(env)
  const config: LazyJiraConfigFile = { jira: normalizeJiraAuthConfig(auth) }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
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
  if (!isRecord(value) || !isRecord(value.jira)) throw new Error(`Invalid lazyjira config shape at ${path}`)
  const jira = value.jira
  if (typeof jira.baseUrl !== "string" || typeof jira.email !== "string" || typeof jira.apiToken !== "string") {
    throw new Error(`Invalid Jira auth config at ${path}`)
  }
  return { jira: normalizeJiraAuthConfig({ baseUrl: jira.baseUrl, email: jira.email, apiToken: jira.apiToken }) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNoEntry(error: unknown) {
  return isRecord(error) && error.code === "ENOENT"
}
