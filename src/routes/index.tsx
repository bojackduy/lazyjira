import { Match, Switch } from "solid-js"
import { useAppState } from "../context/app-state"
import { BacklogRoute } from "./backlog"
import { BoardRoute } from "./board"
import { ConfigRoute } from "./config"
import { IssueDetailRoute } from "./issue-detail"
import { PlannedProjectView } from "./planned-project-view"
import { ProjectListRoute } from "./project-list"
import { WorkspaceRoute } from "./workspace"

export function RouteSurface() {
  const { state } = useAppState()

  return (
    <Switch fallback={<WorkspaceRoute />}>
      <Match when={state.route === "workspace"}>
        <WorkspaceRoute />
      </Match>
      <Match when={state.route === "timeline"}>
        <PlannedProjectView name="Timeline" plannedWave="N5" />
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
