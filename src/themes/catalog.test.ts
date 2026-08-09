import { describe, expect, test } from "bun:test"
import { builtInThemes, parseThemeFile, resolveTheme, themeColorNames, themeSyntaxNames } from "./catalog"

const catppuccinMocha = JSON.stringify({
  version: 1,
  id: "catppuccin-mocha",
  name: "Catppuccin Mocha",
  extends: "midnight",
  colors: {
    background: "#1e1e2e",
    panel: "#181825",
    border: "#313244",
    borderActive: "#89b4fa",
    text: "#cdd6f4",
    textMuted: "#a6adc8",
    textSubtle: "#6c7086",
    selected: "#313244",
    selectedText: "#cdd6f4",
    accent: "#89b4fa",
    success: "#a6e3a1",
    warning: "#f9e2af",
    danger: "#f38ba8",
  },
  syntax: {
    keyword: "#cba6f7",
    string: "#a6e3a1",
    function: "#89b4fa",
    type: "#94e2d5",
    comment: "#6c7086",
  },
}, null, 2)

describe("theme catalog", () => {
  test("includes midnight and Catppuccin Mocha built-ins", () => {
    expect(builtInThemes.map((theme) => theme.id)).toEqual(["midnight", "catppuccin-mocha"])
  })

  test("provides every color and syntax token in each built-in theme", () => {
    for (const theme of builtInThemes) {
      expect(Object.keys(theme.colors).sort()).toEqual([...themeColorNames].sort())
      expect(Object.keys(theme.syntax).sort()).toEqual([...themeSyntaxNames].sort())
    }
  })

  test("resolves a Catppuccin-style local pack with complete fallback tokens", () => {
    const theme = resolveTheme(parseThemeFile(catppuccinMocha))

    expect(theme.colors.background).toBe("#1e1e2e")
    expect(theme.syntax.keyword).toBe("#cba6f7")
    expect(theme.syntax.attribute).toBe("#FCD34D")
    expect(theme.colors.accentSoft).toBe("#1E3A5F")
  })

  test("rejects unknown tokens and unsafe color values", () => {
    expect(() => parseThemeFile(JSON.stringify({ version: 1, id: "bad", name: "Bad", colors: { nope: "#ffffff" } }))).toThrow("unsupported token")
    expect(() => parseThemeFile(JSON.stringify({ version: 1, id: "bad", name: "Bad", colors: { background: "blue" } }))).toThrow("six-digit hex")
  })

  test("rejects bad ids, bad versions, and unknown extends", () => {
    expect(() => parseThemeFile(JSON.stringify({ version: 1, id: "Bad ID", name: "Bad", colors: {} }))).toThrow("lowercase letters")
    expect(() => parseThemeFile(JSON.stringify({ version: 2, id: "bad", name: "Bad" }))).toThrow("version must be 1")
    expect(() => parseThemeFile(JSON.stringify({ version: 1, id: "bad", name: "Bad", extends: "unknown" }))).toThrow("extends must name a built-in theme")
  })
})
