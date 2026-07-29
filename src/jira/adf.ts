export type JiraRichText = {
  markdown: string
  plainText: string
  writeBlockedReason?: string
}

type AdfNode = {
  type?: unknown
  text?: unknown
  attrs?: unknown
  marks?: unknown
  content?: unknown
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language?: string; text: string }
  | { type: "quote"; panel?: string; lines: string[] }
  | { type: "table"; rows: string[][] }
  | { type: "rule" }

export function adfToRichText(value: unknown): JiraRichText {
  if (typeof value === "string") return { markdown: value, plainText: markdownPlainText(value) }
  if (!isNode(value)) return { markdown: "", plainText: "" }

  const unsupported = new Set<string>()
  const blocks = value.type === "doc" ? nodeArray(value.content) : [value]
  const markdown = blocks.map((node) => renderBlock(node, unsupported)).filter(Boolean).join("\n\n").trim()
  const writeBlockedReason = unsupported.size
    ? `This Jira text contains unsupported ADF content (${[...unsupported].join(", ")}) and cannot be safely replaced yet.`
    : undefined
  return { markdown, plainText: markdownPlainText(markdown), writeBlockedReason }
}

export function markdownToAdf(markdown: string): { document?: Record<string, unknown>; writeBlockedReason?: string } {
  if (/<!--\s*lazyjira-opaque\b/i.test(markdown)) {
    return { writeBlockedReason: "This draft contains unsupported Jira content and cannot be safely written." }
  }

  const blocks = parseMarkdownBlocks(markdown)
  return { document: { type: "doc", version: 1, content: blocks.map(blockToAdf) } }
}

export function markdownPlainText(markdown: string) {
  return markdown
    .replace(/<!--[^]*?-->/g, "")
    .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
    .replace(/!?(\[[^\]]*\])\([^)]+\)/g, "$1")
    .replace(/[>*#`~]/g, "")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function renderBlock(node: AdfNode, unsupported: Set<string>): string {
  const type = nodeType(node)
  if (!type) {
    if (textValue(node)) return escapeMarkdown(textValue(node))
    return nodeArray(node.content).map((child) => renderBlock(child, unsupported)).filter(Boolean).join("\n\n")
  }
  switch (type) {
    case "paragraph":
      return renderInline(nodeArray(node.content), unsupported).trim()
    case "heading": {
      const level = numberAttr(node.attrs, "level", 1)
      return `${"#".repeat(Math.min(6, Math.max(1, level)))} ${renderInline(nodeArray(node.content), unsupported).trim()}`
    }
    case "bulletList":
      return renderList(nodeArray(node.content), false, unsupported)
    case "orderedList":
      return renderList(nodeArray(node.content), true, unsupported)
    case "blockquote":
      return renderQuote(nodeArray(node.content), unsupported)
    case "panel":
      return `> [!panel]\n${renderQuote(nodeArray(node.content), unsupported)}`
    case "codeBlock": {
      const language = stringAttr(node.attrs, "language")
      return [`\`\`\`${language ?? ""}`, nodeArray(node.content).map((child) => textValue(child)).join(""), "\`\`\`"].join("\n")
    }
    case "rule":
      return "---"
    case "table":
      return renderTable(nodeArray(node.content), unsupported)
    default:
      unsupported.add(type || "unknown")
      return unsupportedMarker(type || "unknown", nodeText(node))
  }
}

function renderList(items: AdfNode[], ordered: boolean, unsupported: Set<string>) {
  return items.map((item, index) => {
    if (nodeType(item) !== "listItem") {
      unsupported.add(nodeType(item) || "unknown")
      return `${ordered ? `${index + 1}.` : "-"} ${unsupportedMarker(nodeType(item) || "unknown", nodeText(item))}`
    }
    const children = nodeArray(item.content)
    const first = children.find((child) => nodeType(child) === "paragraph")
    const nested = children.filter((child) => nodeType(child) === "bulletList" || nodeType(child) === "orderedList")
    const line = renderInline(nodeArray(first?.content), unsupported).trim()
    const nestedText = nested.map((child) => renderBlock(child, unsupported).split("\n").map((nestedLine) => `  ${nestedLine}`).join("\n")).join("\n")
    return `${ordered ? `${index + 1}.` : "-"} ${line}${nestedText ? `\n${nestedText}` : ""}`.trimEnd()
  }).join("\n")
}

function renderQuote(content: AdfNode[], unsupported: Set<string>) {
  return content.map((child) => renderBlock(child, unsupported)).join("\n\n").split("\n").map((line) => `> ${line}`.trimEnd()).join("\n")
}

function renderTable(rows: AdfNode[], unsupported: Set<string>) {
  const renderedRows = rows.filter((row) => nodeType(row) === "tableRow").map((row) => nodeArray(row.content).map((cell) => {
    const content = nodeArray(cell.content).map((child) => renderBlock(child, unsupported)).join(" ").replace(/\n/g, "<br>")
    return content.replace(/\|/g, "\\|").trim() || " "
  }))
  if (!renderedRows.length) return ""
  const width = Math.max(...renderedRows.map((row) => row.length))
  const normalized = renderedRows.map((row) => Array.from({ length: width }, (_value, index) => row[index] ?? " "))
  return [
    tableRow(normalized[0]!),
    tableRow(Array.from({ length: width }, () => "---")),
    ...normalized.slice(1).map(tableRow),
  ].join("\n")
}

function tableRow(cells: string[]) {
  return `| ${cells.join(" | ")} |`
}

function renderInline(nodes: AdfNode[], unsupported: Set<string>) {
  return nodes.map((node) => {
    const type = nodeType(node)
    if (type === "text" || (!type && textValue(node))) return applyMarks(escapeMarkdown(textValue(node)), nodeArray(node.marks), unsupported)
    if (type === "hardBreak") return "\n"
    if (type === "emoji") return `:${stringAttr(node.attrs, "shortName") ?? stringAttr(node.attrs, "text") ?? "emoji"}:`
    if (type === "mention") return `@${stringAttr(node.attrs, "text") ?? "mention"}`
    unsupported.add(type || "unknown")
    return `[${type || "unsupported"}: ${nodeText(node)}]`
  }).join("")
}

function applyMarks(text: string, marks: AdfNode[], unsupported: Set<string>) {
  return marks.reduce((value, mark) => {
    switch (nodeType(mark)) {
      case "strong": return `**${value}**`
      case "em": return `*${value}*`
      case "strike": return `~~${value}~~`
      case "code": return `\`${value.replace(/`/g, "\\`")}\``
      case "link": return `[${value}](${stringAttr(mark.attrs, "href") ?? ""})`
      default:
        unsupported.add(nodeType(mark) || "unknown mark")
        return value
    }
  }, text)
}

function unsupportedMarker(type: string, text: string) {
  const detail = text.trim() ? `\n> ${text.trim()}` : ""
  return `> [Unsupported Jira content: ${type}]${detail}\n<!-- lazyjira-opaque type="${type}" -->`
}

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n")
  const blocks: MarkdownBlock[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!
    if (!line.trim()) { index += 1; continue }
    const fence = /^```([^`]*)\s*$/.exec(line)
    if (fence) {
      const content: string[] = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index]!)) content.push(lines[index++]!)
      if (index < lines.length) index += 1
      blocks.push({ type: "code", language: fence[1]!.trim() || undefined, text: content.join("\n") })
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) { blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]!.trim() }); index += 1; continue }
    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push({ type: "rule" }); index += 1; continue }
    if (isTableStart(lines, index)) {
      const rows = [splitTableRow(line)]
      index += 2
      while (index < lines.length && lines[index]!.includes("|") && lines[index]!.trim()) rows.push(splitTableRow(lines[index++]!))
      blocks.push({ type: "table", rows })
      continue
    }
    const list = listItem(line)
    if (list) {
      const items: string[] = []
      while (index < lines.length) {
        const item = listItem(lines[index]!)
        if (!item || item.ordered !== list.ordered) break
        items.push(item.text)
        index += 1
      }
      blocks.push({ type: "list", ordered: list.ordered, items })
      continue
    }
    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index]!)) quoteLines.push(lines[index++]!.replace(/^>\s?/, ""))
      const panel = quoteLines[0] === "[!panel]" ? quoteLines.shift() : undefined
      blocks.push({ type: "quote", panel, lines: quoteLines })
      continue
    }
    const paragraph: string[] = []
    while (index < lines.length && lines[index]!.trim() && !startsBlock(lines, index)) paragraph.push(lines[index++]!)
    blocks.push({ type: "paragraph", lines: paragraph })
  }
  return blocks
}

function blockToAdf(block: MarkdownBlock): Record<string, unknown> {
  switch (block.type) {
    case "heading": return { type: "heading", attrs: { level: block.level }, content: inlineToAdf(block.text) }
    case "paragraph": return { type: "paragraph", content: linesToAdf(block.lines) }
    case "list": return { type: block.ordered ? "orderedList" : "bulletList", content: block.items.map((item) => ({ type: "listItem", content: [{ type: "paragraph", content: inlineToAdf(item) }] })) }
    case "code": return { type: "codeBlock", attrs: block.language ? { language: block.language } : undefined, content: block.text ? [{ type: "text", text: block.text }] : [] }
    case "quote": return { type: block.panel ? "panel" : "blockquote", content: [{ type: "paragraph", content: linesToAdf(block.lines) }] }
    case "table": return { type: "table", content: block.rows.map((row, rowIndex) => ({ type: "tableRow", content: row.map((cell) => ({ type: rowIndex === 0 ? "tableHeader" : "tableCell", content: [{ type: "paragraph", content: inlineToAdf(cell.replace(/<br>/g, "\n")) }] })) })) }
    case "rule": return { type: "rule" }
  }
}

function linesToAdf(lines: string[]) {
  return lines.flatMap((line, index) => [...inlineToAdf(line), ...(index < lines.length - 1 ? [{ type: "hardBreak" }] : [])])
}

function inlineToAdf(value: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []
  const pattern = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    appendText(result, value.slice(last, match.index))
    const token = match[0]!
    if (token.startsWith("**")) appendText(result, token.slice(2, -2), [{ type: "strong" }])
    else if (token.startsWith("~~")) appendText(result, token.slice(2, -2), [{ type: "strike" }])
    else if (token.startsWith("`")) appendText(result, token.slice(1, -1), [{ type: "code" }])
    else if (token.startsWith("*")) appendText(result, token.slice(1, -1), [{ type: "em" }])
    else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
      appendText(result, link?.[1] ?? token, link ? [{ type: "link", attrs: { href: link[2] } }] : undefined)
    }
    last = pattern.lastIndex
  }
  appendText(result, value.slice(last))
  return result
}

function appendText(result: Record<string, unknown>[], value: string, marks?: Record<string, unknown>[]) {
  const lines = value.split("\n")
  lines.forEach((line, index) => {
    if (line) result.push({ type: "text", text: unescapeMarkdown(line), ...(marks ? { marks } : {}) })
    if (index < lines.length - 1) result.push({ type: "hardBreak" })
  })
}

function startsBlock(lines: string[], index: number) {
  const line = lines[index]!
  return /^```/.test(line) || /^(#{1,6})\s+/.test(line) || /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line) || !!listItem(line) || /^>\s?/.test(line) || isTableStart(lines, index)
}

function isTableStart(lines: string[], index: number) {
  return lines[index]?.includes("|") && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] ?? "")
}

function listItem(line: string) {
  const unordered = /^\s{0,3}[-*+]\s+(.+)$/.exec(line)
  if (unordered) return { ordered: false, text: unordered[1]!.trim() }
  const ordered = /^\s{0,3}\d+[.)]\s+(.+)$/.exec(line)
  return ordered ? { ordered: true, text: ordered[1]!.trim() } : undefined
}

function splitTableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim().replace(/\\\|/g, "|"))
}

function nodeArray(value: unknown): AdfNode[] {
  return Array.isArray(value) ? value.filter(isNode) : []
}

function isNode(value: unknown): value is AdfNode {
  return !!value && typeof value === "object"
}

function nodeType(node: AdfNode) {
  return typeof node.type === "string" ? node.type : ""
}

function textValue(node: AdfNode) {
  return typeof node.text === "string" ? node.text : ""
}

function nodeText(node: AdfNode): string {
  return `${textValue(node)}${nodeArray(node.content).map(nodeText).join("")}`
}

function stringAttr(attrs: unknown, key: string) {
  return isNode(attrs) && typeof attrs[key as keyof AdfNode] === "string" ? attrs[key as keyof AdfNode] as string : undefined
}

function numberAttr(attrs: unknown, key: string, fallback: number) {
  return isNode(attrs) && typeof attrs[key as keyof AdfNode] === "number" ? attrs[key as keyof AdfNode] as number : fallback
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}\[\]<>])/g, "\\$1")
}

function unescapeMarkdown(value: string) {
  return value.replace(/\\([\\`*_{}\[\]<>])/g, "$1")
}
