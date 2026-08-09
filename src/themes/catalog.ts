export const themeColorNames = ["background", "panel", "border", "borderActive", "text", "textMuted", "textSubtle", "selected", "selectedText", "accent", "accentSoft", "warningBg", "success", "warning", "danger"] as const
export const themeSyntaxNames = ["heading", "heading2", "heading3", "heading4", "italic", "linkLabel", "raw", "rawBg", "list", "quote", "comment", "keyword", "string", "number", "function", "type", "property", "operator", "tag", "attribute"] as const

export type ThemeColorName = (typeof themeColorNames)[number]
export type ThemeSyntaxName = (typeof themeSyntaxNames)[number]
export type ThemeColorPalette = Record<ThemeColorName, string>
export type ThemeSyntaxPalette = Record<ThemeSyntaxName, string>

export type ResolvedTheme = {
  id: string
  name: string
  colors: ThemeColorPalette
  syntax: ThemeSyntaxPalette
}

export type AvailableTheme = ResolvedTheme & { source: "built-in" | "user"; path?: string }

export type ThemeFile = {
  version: 1
  id: string
  name: string
  extends?: string
  colors?: Partial<ThemeColorPalette>
  syntax?: Partial<ThemeSyntaxPalette>
}

const midnight: ResolvedTheme = {
  id: "midnight",
  name: "Midnight",
  colors: {
    background: "#0B1020",
    panel: "#111827",
    border: "#334155",
    borderActive: "#38BDF8",
    text: "#E5E7EB",
    textMuted: "#94A3B8",
    textSubtle: "#64748B",
    selected: "#1D4ED8",
    selectedText: "#F8FAFC",
    accent: "#38BDF8",
    accentSoft: "#1E3A5F",
    warningBg: "#1F1607",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  syntax: {
    heading: "#BFDBFE",
    heading2: "#93C5FD",
    heading3: "#BFDBFE",
    heading4: "#DBEAFE",
    italic: "#C4B5FD",
    linkLabel: "#67E8F9",
    raw: "#FDE68A",
    rawBg: "#1F2937",
    list: "#C4B5FD",
    quote: "#CBD5E1",
    comment: "#64748B",
    keyword: "#C4B5FD",
    string: "#86EFAC",
    number: "#FBBF24",
    function: "#93C5FD",
    type: "#67E8F9",
    property: "#BAE6FD",
    operator: "#F0ABFC",
    tag: "#FDA4AF",
    attribute: "#FCD34D",
  },
}

const catppuccinMocha: ResolvedTheme = {
  id: "catppuccin-mocha",
  name: "Catppuccin Mocha",
  colors: {
    background: "#1E1E2E",
    panel: "#181825",
    border: "#313244",
    borderActive: "#89B4FA",
    text: "#CDD6F4",
    textMuted: "#A6ADC8",
    textSubtle: "#6C7086",
    selected: "#313244",
    selectedText: "#CDD6F4",
    accent: "#89B4FA",
    accentSoft: "#313244",
    warningBg: "#302D41",
    success: "#A6E3A1",
    warning: "#F9E2AF",
    danger: "#F38BA8",
  },
  syntax: {
    heading: "#94E2D5",
    heading2: "#89B4FA",
    heading3: "#94E2D5",
    heading4: "#CDD6F4",
    italic: "#C6A0F6",
    linkLabel: "#89DCEB",
    raw: "#F9E2AF",
    rawBg: "#313244",
    list: "#C6A0F6",
    quote: "#A6ADC8",
    comment: "#6C7086",
    keyword: "#C6A0F6",
    string: "#A6E3A1",
    number: "#FAB387",
    function: "#89B4FA",
    type: "#94E2D5",
    property: "#89DCEB",
    operator: "#F5C2E7",
    tag: "#F38BA8",
    attribute: "#F9E2AF",
  },
}

export const builtInThemes: readonly ResolvedTheme[] = [midnight, catppuccinMocha]
export const defaultThemeId = "midnight"

export function resolveTheme(file: ThemeFile): ResolvedTheme {
  const base = builtInThemes.find((theme) => theme.id === (file.extends ?? defaultThemeId)) ?? midnight
  return { id: file.id, name: file.name, colors: { ...base.colors, ...file.colors }, syntax: { ...base.syntax, ...file.syntax } }
}

export function themeStarter(id: string, name = id) {
  const file: ThemeFile = {
    version: 1,
    id,
    name,
    extends: defaultThemeId,
    colors: { background: midnight.colors.background, panel: midnight.colors.panel, borderActive: midnight.colors.borderActive, accent: midnight.colors.accent, accentSoft: midnight.colors.accentSoft },
    syntax: { heading: midnight.syntax.heading, keyword: midnight.syntax.keyword, string: midnight.syntax.string },
  }
  return `${JSON.stringify(file, null, 2)}\n`
}

export function parseThemeFile(text: string): ThemeFile {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error("Theme file must contain valid JSON.")
  }
  if (!isRecord(value)) throw new Error("Theme file must be a JSON object.")
  assertOnlyKeys(value, ["version", "id", "name", "extends", "colors", "syntax"], "Theme")
  if (value.version !== 1) throw new Error("Theme version must be 1.")
  const id = stringValue(value.id, "Theme id")
  if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(id)) throw new Error("Theme id must use lowercase letters, numbers, and hyphens.")
  const name = stringValue(value.name, "Theme name")
  const extendsId = value.extends === undefined ? undefined : stringValue(value.extends, "Theme extends")
  if (extendsId && !builtInThemes.some((theme) => theme.id === extendsId)) throw new Error(`Theme extends must name a built-in theme: ${builtInThemes.map((theme) => theme.id).join(", ")}.`)
  return {
    version: 1,
    id,
    name,
    ...(extendsId ? { extends: extendsId } : {}),
    colors: parseColorOverrides(value.colors, themeColorNames, "colors"),
    syntax: parseColorOverrides(value.syntax, themeSyntaxNames, "syntax"),
  }
}

function parseColorOverrides(value: unknown, allowed: readonly string[], label: string) {
  if (value === undefined) return undefined
  if (!isRecord(value)) throw new Error(`Theme ${label} must be an object.`)
  const result: Record<string, string> = {}
  for (const [key, color] of Object.entries(value)) {
    if (!allowed.includes(key)) throw new Error(`Theme ${label} has unsupported token: ${key}.`)
    const hex = stringValue(color, `Theme ${label}.${key}`)
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Theme ${label}.${key} must be a six-digit hex color.`)
    result[key] = hex.toLowerCase()
  }
  return result
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label} has unsupported field: ${key}.`)
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`)
  return value.trim()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function titleFromId(id: string) {
  return id.split("-").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ")
}
