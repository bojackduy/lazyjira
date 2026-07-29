import { RGBA, SyntaxStyle } from "@opentui/core"
import { For, Show } from "solid-js"
import { useTheme } from "../context/theme"
import { splitJiraRichText, type JiraRichTextPart } from "../jira/adf"

export function RichText(props: { markdown: string; writeBlockedReason?: string; compact?: boolean }) {
  const theme = useTheme()
  const parts = () => splitJiraRichText(props.markdown)
  const style = () => SyntaxStyle.fromStyles({
    "markup.heading": { fg: RGBA.fromHex("#BFDBFE"), bold: true },
    "markup.heading.1": { fg: RGBA.fromHex(theme.accent), bold: true, underline: true },
    "markup.heading.2": { fg: RGBA.fromHex("#93C5FD"), bold: true },
    "markup.heading.3": { fg: RGBA.fromHex("#BFDBFE"), bold: true },
    "markup.heading.4": { fg: RGBA.fromHex("#DBEAFE"), bold: true },
    "markup.heading.5": { fg: RGBA.fromHex("#DBEAFE"), bold: true },
    "markup.heading.6": { fg: RGBA.fromHex("#DBEAFE"), bold: true },
    "markup.strong": { fg: RGBA.fromHex(theme.text), bold: true },
    "markup.italic": { fg: RGBA.fromHex("#C4B5FD"), italic: true },
    "markup.strikethrough": { fg: RGBA.fromHex(theme.textSubtle), dim: true },
    "markup.link": { fg: RGBA.fromHex(theme.accent), underline: true },
    "markup.link.label": { fg: RGBA.fromHex("#67E8F9"), underline: true },
    "markup.link.url": { fg: RGBA.fromHex(theme.textSubtle), dim: true },
    "markup.list": { fg: RGBA.fromHex("#C4B5FD") },
    "markup.quote": { fg: RGBA.fromHex("#CBD5E1"), italic: true },
    "markup.raw": { fg: RGBA.fromHex("#FDE68A"), bg: RGBA.fromHex("#1F2937") },
    conceal: { fg: RGBA.fromHex(theme.textSubtle), dim: true },
    keyword: { fg: RGBA.fromHex("#C4B5FD"), bold: true },
    string: { fg: RGBA.fromHex("#86EFAC") },
    number: { fg: RGBA.fromHex("#FBBF24") },
    function: { fg: RGBA.fromHex("#93C5FD") },
    type: { fg: RGBA.fromHex("#67E8F9") },
    default: { fg: RGBA.fromHex(theme.text) },
  })

  return (
    <box flexDirection="column" gap={1} minWidth={0}>
      <Show when={props.writeBlockedReason}>
        {(reason) => <text fg={theme.warning}>{reason()}</text>}
      </Show>
      <Show when={props.markdown.trim()} fallback={<text fg={theme.textMuted}>No description</text>}>
        <For each={parts()}>{(part) => <RichTextPart part={part} compact={props.compact} style={style()} />}</For>
      </Show>
    </box>
  )
}

function RichTextPart(props: { part: JiraRichTextPart; compact?: boolean; style: SyntaxStyle }) {
  const theme = useTheme()
  if (props.part.type === "mention") return <text fg={theme.accent}>@{props.part.label}</text>
  if (props.part.type === "emoji") return <text fg={theme.warning}>:{props.part.shortName}:</text>
  if (props.part.type === "status") return <text fg={statusColor(theme, props.part.color)}>[{props.part.label}]</text>
  if (props.part.type === "date") return <text fg={theme.warning}>{formatDate(props.part.timestamp)}</text>
  if (props.part.type === "card") return <text fg={theme.accent}>{props.part.label} · {props.part.url}</text>
  if (props.part.type === "expand") return <text fg={theme.warning}>[+] {props.part.title}</text>
  return (
    <markdown
      content={props.part.content}
      syntaxStyle={props.style}
      fg={theme.text}
      bg={theme.panel}
      width="100%"
      conceal
      concealCode={false}
      tableOptions={{ style: "grid", widthMode: "full", columnFitter: "balanced", wrapMode: "word", cellPaddingX: props.compact ? 0 : 1, borderStyle: "rounded", borderColor: theme.border, selectable: true }}
    />
  )
}

function statusColor(theme: ReturnType<typeof useTheme>, color: string) {
  if (color === "green") return theme.success
  if (color === "yellow") return theme.warning
  if (color === "red") return theme.danger
  if (color === "blue" || color === "purple") return theme.accent
  return theme.textMuted
}

function formatDate(timestamp: string) {
  const number = Number(timestamp)
  if (Number.isFinite(number)) return new Date(number).toISOString().slice(0, 10)
  return timestamp
}
