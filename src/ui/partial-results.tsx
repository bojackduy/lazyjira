import { Show } from "solid-js"
import { useTheme } from "../context/theme"
import type { IssuePageState } from "../state/app-state"
import { issuePageActionVisible, loadMoreActionText, partialResultsBannerText } from "../state/issue-pages"

export function PartialResultsBanner(props: { page?: IssuePageState }) {
  const theme = useTheme()
  return (
    <Show when={props.page && partialResultsBannerText(props.page)}>
      {(text) => <text fg={props.page?.error ? theme.danger : theme.warning} wrapMode="none">{text()}</text>}
    </Show>
  )
}

export function LoadMoreActionRow(props: { page?: IssuePageState; selected: boolean; id?: string }) {
  const theme = useTheme()
  return (
    <Show when={props.page && issuePageActionVisible(props.page)}>
      <box id={props.id} height={1} flexShrink={0} paddingLeft={1} backgroundColor={props.selected ? theme.selected : undefined}>
        <text fg={props.selected ? theme.selectedText : props.page?.error ? theme.danger : props.page?.loading ? theme.warning : theme.accent} wrapMode="none">
          {props.selected ? ">" : " "} {loadMoreActionText(props.page!)}
        </text>
      </box>
    </Show>
  )
}
