import { PNG } from "pngjs"
import { jiraBasicAuthHeader, type JiraAuthConfig } from "../auth/config"
import type { FetchLike } from "./client"

export async function fetchJiraIconColor(auth: JiraAuthConfig, iconUrl: string, fetchImpl: FetchLike = fetch) {
  const resolvedUrl = new URL(iconUrl, auth.baseUrl)
  const headers: Record<string, string> = { Accept: "image/svg+xml,image/png,image/*" }
  if (resolvedUrl.origin === new URL(auth.baseUrl).origin) headers.Authorization = jiraBasicAuthHeader(auth)
  const response = await fetchImpl(resolvedUrl.toString(), { headers })
  if (!response.ok) throw new Error(`Jira icon returned HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  if (contentType.includes("svg") || bytes.subarray(0, 256).toString("utf8").includes("<svg")) return svgColor(bytes.toString("utf8"))
  return pngColor(bytes)
}

function svgColor(svg: string) {
  const colors = [...svg.matchAll(/(?:fill|stroke)=["'](#[0-9a-fA-F]{6})["']/g)].map((match) => match[1]!)
  return colors.find(isVisibleAccent)?.toUpperCase()
}

function pngColor(bytes: Buffer) {
  const image = PNG.sync.read(bytes)
  const buckets = new Map<number, { count: number; red: number; green: number; blue: number; score: number }>()
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset]!
    const green = image.data[offset + 1]!
    const blue = image.data[offset + 2]!
    const alpha = image.data[offset + 3]!
    const range = Math.max(red, green, blue) - Math.min(red, green, blue)
    if (alpha < 64 || range < 24 || Math.max(red, green, blue) < 40 || Math.min(red, green, blue) > 235) continue
    const key = (red >> 4) << 8 | (green >> 4) << 4 | (blue >> 4)
    const bucket = buckets.get(key) ?? { count: 0, red: 0, green: 0, blue: 0, score: 0 }
    bucket.count += 1
    bucket.red += red
    bucket.green += green
    bucket.blue += blue
    bucket.score += range * alpha
    buckets.set(key, bucket)
  }
  const selected = [...buckets.values()].sort((left, right) => right.score - left.score)[0]
  if (!selected) return undefined
  return hex(selected.red / selected.count, selected.green / selected.count, selected.blue / selected.count)
}

function isVisibleAccent(color: string) {
  const value = Number.parseInt(color.slice(1), 16)
  const red = value >> 16
  const green = value >> 8 & 0xff
  const blue = value & 0xff
  return Math.max(red, green, blue) - Math.min(red, green, blue) >= 24 && Math.max(red, green, blue) >= 40 && Math.min(red, green, blue) <= 235
}

function hex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("").toUpperCase()}`
}
