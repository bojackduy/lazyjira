import { Match, Switch } from "solid-js"
import { useAppState } from "../context/app-state"
import { BacklogRoute } from "./backlog"
import { BoardRoute } from "./board"
import { ConfigRoute } from "./config"
import { IssueDetailRoute } from "./issue-detail"
import { ProjectListRoute } from "./project-list"
import { TimelineRoute } from "./timeline"
import { WorkspaceRoute } from "./workspace"

export function RouteSurface() {
  const { state } = useAppState()

  return (
    <Switch fallback={<WorkspaceRoute />}>
      <Match when={state.route === "workspace"}>
        <WorkspaceRoute />
      </Match>
      <Match when={state.route === "timeline"}>
        <TimelineRoute />
      </Match>
      <Match when={state.route === "backlog"}>
        <BacklogRoute />
      </Match>
      <Match when={state.route === "list"}>
        <ProjectListRoute />
      </Match>
      <Match when={state.route === "board"}>
        <BoardRoute />
      </Match>
      <Match when={state.route === "config"}>
        <ConfigRoute />
      </Match>
      <Match when={state.route === "issue-detail"}>
        <IssueDetailRoute />
      </Match>
    </Switch>
  )
}
