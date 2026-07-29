import { RGBA, SyntaxStyle } from "@opentui/core"
import { Show } from "solid-js"
import { useTheme } from "../context/theme"

export function RichText(props: { markdown: string; writeBlockedReason?: string; compact?: boolean }) {
  const theme = useTheme()
  const style = () => SyntaxStyle.fromStyles({
    "markup.heading": { fg: RGBA.fromHex(theme.accent), bold: true },
    "markup.strong": { fg: RGBA.fromHex(theme.text), bold: true },
    "markup.italic": { fg: RGBA.fromHex("#C4B5FD"), italic: true },
    "markup.strikethrough": { fg: RGBA.fromHex(theme.textSubtle), dim: true },
    "markup.link": { fg: RGBA.fromHex(theme.accent), underline: true },
    "markup.link.label": { fg: RGBA.fromHex("#67E8F9"), underline: true },
    "markup.link.url": { fg: RGBA.fromHex(theme.textSubtle), dim: true },
    "markup.list": { fg: RGBA.fromHex("#C4B5FD") },
    "markup.quote": { fg: RGBA.fromHex("#CBD5E1"), italic: true },
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
        <markdown
          content={props.markdown}
          syntaxStyle={style()}
          fg={theme.text}
          bg={theme.panel}
          width="100%"
          conceal
          concealCode={false}
          tableOptions={{ style: "grid", widthMode: "full", columnFitter: "balanced", wrapMode: "word", cellPaddingX: props.compact ? 0 : 1, borderStyle: "rounded", borderColor: theme.border, selectable: true }}
        />
      </Show>
    </box>
  )
}
