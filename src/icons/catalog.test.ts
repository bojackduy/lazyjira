import { describe, expect, test } from "bun:test"
import { createIconSelector, iconCatalogs, iconModes, parseIconMode, resolveIssueTypeIcon, resolveSafeIconMode, selectIcons, selectIconsFromEnv } from "./catalog"

describe("icon profiles", () => {
  test("parses supported modes and defaults invalid values to unicode", () => {
    expect(parseIconMode(undefined)).toBe("unicode")
    expect(parseIconMode(" NERD ")).toBe("nerd")
    expect(parseIconMode("unicode")).toBe("unicode")
    expect(parseIconMode("ASCII")).toBe("ascii")
    expect(parseIconMode("emoji")).toBe("unicode")
    expect(parseIconMode(1)).toBe("unicode")
  })

  test("selects one complete catalog without changing profile identity", () => {
    for (const mode of iconModes) {
      const icons = createIconSelector(mode)
      expect(icons.mode).toBe(mode)
      expect(icons.catalog).toBe(iconCatalogs[mode])
    }
    expect(selectIcons("invalid").catalog).toBe(iconCatalogs.unicode)
    expect(selectIconsFromEnv({ LAZYJIRA_ICON_MODE: "nerd" }).catalog).toBe(iconCatalogs.nerd)
    expect(selectIconsFromEnv({ LAZYJIRA_ICON_MODE: "invalid" }).catalog).toBe(iconCatalogs.unicode)
  })

  test("falls back conservatively when a profile violates the one-cell contract", () => {
    expect(resolveSafeIconMode("nerd", (glyph) => glyph.codePointAt(0)! >= 0xf000 ? 2 : Bun.stringWidth(glyph))).toBe("unicode")
    expect(resolveSafeIconMode("unicode", (glyph) => /[^\x00-\x7f]/.test(glyph) ? 2 : Bun.stringWidth(glyph))).toBe("ascii")
    expect(resolveSafeIconMode("ascii", () => 2)).toBe("ascii")
  })

  test("keeps every semantic glyph to one terminal cell", () => {
    for (const mode of iconModes) {
      for (const [token, glyph] of catalogGlyphs(iconCatalogs[mode])) {
        expect(Bun.stringWidth(glyph), `${mode}.${token} (${JSON.stringify(glyph)})`).toBe(1)
      }
    }
  })

  test("uses Jira-style Nerd Font issue-type glyphs", () => {
    expect(iconCatalogs.nerd.issueType.story.codePointAt(0)).toBe(0xf02e)
    expect(iconCatalogs.nerd.issueType.epic.codePointAt(0)).toBe(0xf0e7)
    expect(iconCatalogs.nerd.issueType.task.codePointAt(0)).toBe(0xf14a)
    expect(iconCatalogs.nerd.issueType.subtask.codePointAt(0)).toBe(0xf0645)
    expect(iconCatalogs.nerd.issueType.bug.codePointAt(0)).toBe(0xf188)
  })

  test("keeps Nerd glyphs in the BMP except for the v3 file-tree Sub-task icon", () => {
    for (const [token, glyph] of catalogGlyphs(iconCatalogs.nerd)) {
      expect([...glyph], token).toHaveLength(1)
      const codePoint = glyph.codePointAt(0) ?? 0
      if (token === "issueType.subtask") expect(codePoint).toBe(0xf0645)
      else expect(codePoint, token).toBeLessThanOrEqual(0xffff)
    }
  })
})

describe("issue type icon resolution", () => {
  const catalog = iconCatalogs.unicode

  test("resolves exact normalized common names before metadata fallbacks", () => {
    expect(resolveIssueTypeIcon(catalog, { name: " Bug " })).toBe(catalog.issueType.bug)
    expect(resolveIssueTypeIcon(catalog, { name: "USER-STORY" })).toBe(catalog.issueType.story)
    expect(resolveIssueTypeIcon(catalog, { name: "Task", subtask: true, hierarchyLevel: 2 })).toBe(catalog.issueType.task)
    expect(resolveIssueTypeIcon(catalog, { name: "Sub-task" })).toBe(catalog.issueType.subtask)
    expect(resolveIssueTypeIcon(catalog, { name: "Epic" })).toBe(catalog.issueType.epic)
    expect(resolveIssueTypeIcon(catalog, { name: "Feature" })).toBe(catalog.issueType.feature)
    expect(resolveIssueTypeIcon(catalog, { name: "Initiative" })).toBe(catalog.issueType.initiative)
  })

  test("falls back through subtask, positive hierarchy, then generic", () => {
    expect(resolveIssueTypeIcon(catalog, { name: "Technical child", subtask: true, hierarchyLevel: 3 })).toBe(catalog.issueType.subtask)
    expect(resolveIssueTypeIcon(catalog, { name: "Portfolio outcome", hierarchyLevel: 1 })).toBe(catalog.issueType.hierarchy)
    expect(resolveIssueTypeIcon(catalog, { name: "Portfolio outcome", hierarchyLevel: 0 })).toBe(catalog.issueType.generic)
    expect(resolveIssueTypeIcon(catalog, {})).toBe(catalog.issueType.generic)
  })

  test("provides status and priority resolution through the shared selector", () => {
    const icons = createIconSelector("unicode")
    expect(icons.status({ name: "QA", category: "in-progress" })).toBe(icons.catalog.status.review)
    expect(icons.status({ name: "Ready for QA", category: "in-progress" })).toBe(icons.catalog.status.review)
    expect(icons.status({ name: "Ready for ACC/UAT", category: "in-progress" })).toBe(icons.catalog.status.review)
    expect(icons.status({ name: "Waiting for APIs", category: "in-progress" })).toBe(icons.catalog.status.blocked)
    expect(icons.status({ category: "done" })).toBe(icons.catalog.status.done)
    expect(icons.priority("Critical")).toBe(icons.catalog.priority.critical)
    expect(icons.priority("Tenant custom")).toBe(icons.catalog.priority.generic)
  })
})

function catalogGlyphs(catalog: (typeof iconCatalogs)[keyof typeof iconCatalogs]): Array<[string, string]> {
  return Object.entries(catalog).flatMap(([group, value]) => {
    if (group === "mode" || typeof value === "string") return []
    return Object.entries(value).map(([token, glyph]) => [`${group}.${token}`, glyph] as [string, string])
  })
}
