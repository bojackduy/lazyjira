import { describe, expect, test } from "bun:test"
import { adfToRichText, markdownToAdf } from "./adf"

describe("Jira ADF rich text", () => {
  test("maps supported block and inline content to Markdown", () => {
    const result = adfToRichText({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Plan" }] },
        { type: "paragraph", content: [
          { type: "text", text: "Ship", marks: [{ type: "strong" }] },
          { type: "text", text: " " },
          { type: "text", text: "this", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
          { type: "hardBreak" },
          { type: "text", text: "week" },
        ] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Verify" }] }] }] },
        { type: "codeBlock", attrs: { language: "ts" }, content: [{ type: "text", text: "const ok = true" }] },
      ],
    })

    expect(result).toMatchObject({
      markdown: "## Plan\n\n**Ship** [this](https://example.com)\nweek\n\n- Verify\n\n```ts\nconst ok = true\n```",
      writeBlockedReason: undefined,
    })
  })

  test("keeps unsupported ADF readable but blocks a replacement", () => {
    const result = adfToRichText({ type: "doc", content: [{ type: "mediaSingle", content: [] }] })

    expect(result.markdown).toContain("Unsupported Jira content: mediaSingle")
    expect(result.markdown).toContain("lazyjira-opaque")
    expect(result.writeBlockedReason).toContain("mediaSingle")
    expect(markdownToAdf(result.markdown).writeBlockedReason).toContain("unsupported Jira content")
  })

  test("writes supported Markdown as ADF", () => {
    const result = markdownToAdf("# Title\n\n**Bold** and [link](https://example.com)\n\n- One\n- Two")

    expect(result.writeBlockedReason).toBeUndefined()
    expect(result.document).toEqual({
      type: "doc",
      version: 1,
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Title" }] },
        { type: "paragraph", content: [
          { type: "text", text: "Bold", marks: [{ type: "strong" }] },
          { type: "text", text: " and " },
          { type: "text", text: "link", marks: [{ type: "link", attrs: { href: "https://example.com" } }] },
        ] },
        { type: "bulletList", content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "One" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Two" }] }] },
        ] },
      ],
    })
  })

  test("round-trips Jira text directives without flattening their identity", () => {
    const markdown = [
      "@[Duy](jira-mention://account-1) :rocket:",
      "",
      "[[status:In Review|yellow]]",
      "[[date:1765843200000]]",
      "",
      "- [ ] Verify release",
      "- [x] Notify team",
      "",
      "[[expand:Rollout notes]]",
      "Keep this reversible.",
      "[[/expand]]",
    ].join("\n")
    const written = markdownToAdf(markdown)

    const content = (written.document?.content ?? []) as Array<Record<string, unknown>>
    expect(content[0]).toMatchObject({ type: "paragraph", content: [{ type: "mention", attrs: { id: "account-1", text: "Duy" } }, { type: "text", text: " " }, { type: "emoji", attrs: { shortName: "rocket" } }] })
    expect(content).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "taskList", content: [
        expect.objectContaining({ type: "taskItem", attrs: { state: "TODO" } }),
        expect.objectContaining({ type: "taskItem", attrs: { state: "DONE" } }),
      ] }),
      expect.objectContaining({ type: "expand", attrs: { title: "Rollout notes" } }),
    ]))
    expect(JSON.stringify(written.document)).toContain('"type":"status"')
    expect(JSON.stringify(written.document)).toContain('"type":"date"')

    const read = adfToRichText(written.document)
    expect(read.markdown).toContain("@[Duy](jira-mention://account-1)")
    expect(read.markdown).toContain(":rocket:")
    expect(read.markdown).toContain("[[status:In Review|yellow]]")
    expect(read.markdown).toContain("- [ ] Verify release")
    expect(read.markdown).toContain("[[expand:Rollout notes]]")
    expect(read.writeBlockedReason).toBeUndefined()
  })
})
