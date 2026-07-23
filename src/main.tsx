import { createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { App } from "./app"
import { runAuthCli } from "./auth/cli"
import { jiraAuthSummary, loadJiraAuthConfig, loadLazyJiraConfig, saveDevWorkspaceConfig, saveProdWorkspaceConfig } from "./auth/config"
import type { AppConfig } from "./context/config"
import { LazyJiraKeymapProvider } from "./context/keymap"
import { AppProviders } from "./context/providers"
import { parseRuntimeEnv } from "./runtime/env"
import { createInitialAppState } from "./state/initial"
import { loadDevWorkspaceFixture } from "./workspace/dev/fixtures"
import { createDevWorkspaceSource } from "./workspace/dev/source"
import { createProdWorkspaceSource } from "./workspace/prod/source"
import type { WorkspaceSelection } from "./workspace/types"

const argv = process.argv.slice(2)
if (await runAuthCli(argv)) process.exit(process.exitCode ?? 0)

const runtimeEnv = parseRuntimeEnvOrExit(argv)

let authLoadError: string | undefined
const savedConfig = await loadLazyJiraConfig().catch((error) => {
  authLoadError = error instanceof Error ? error.message : String(error)
  return undefined
})
const authConfig = runtimeEnv === "prod" ? await loadJiraAuthConfig().catch((error) => {
  authLoadError = error instanceof Error ? error.message : String(error)
  return undefined
}) : undefined
const workspaceConfig = runtimeEnv === "dev" ? savedConfig?.devWorkspace : savedConfig?.prodWorkspace
const source = runtimeEnv === "dev" ? createDevWorkspaceSource() : createProdWorkspaceSource()
const initialWorkspace = workspaceConfig
  ? await source.loadWorkspace(selectionFromConfig(workspaceConfig))
  : runtimeEnv === "dev"
    ? loadDevWorkspaceFixture("PROJ")
    : await source.loadWorkspace({ project: { key: "JIRA", name: "No project selected" }, board: { id: "", name: "Choose a project", type: "kanban" } })
const initialState = createInitialAppState(initialWorkspace, runtimeEnv)
const shouldOpenProjectPicker = !workspaceConfig && (runtimeEnv === "dev" || !!authConfig)
initialState.jiraAuthReady = !!authConfig
initialState.jiraProjectReady = !!workspaceConfig
initialState.authOnboarding = {
  open: runtimeEnv === "prod" && !authConfig,
  step: "baseUrl",
  baseUrl: authConfig?.baseUrl ?? "",
  email: authConfig?.email ?? "",
  apiToken: "",
  saving: false,
  error: authLoadError,
}
initialState.projectPicker = {
  open: shouldOpenProjectPicker,
  step: "project",
  searchOpen: false,
  searchQuery: "",
  loading: false,
  saving: false,
  selectedIndex: 0,
  projects: [],
  boards: [],
}
const saveWorkspaceConfig = runtimeEnv === "dev" ? saveDevWorkspaceConfig : saveProdWorkspaceConfig
const appConfig: AppConfig = {
  appName: "lazyjira",
  runtimeEnv,
  jira: authConfig ? jiraAuthSummary(authConfig) : undefined,
}

let resolveShutdown!: () => void
const shutdown = new Promise<void>((resolve) => {
  resolveShutdown = resolve
})

const renderer = await createCliRenderer({
  targetFps: 30,
  exitOnCtrlC: false,
  useKittyKeyboard: {},
  autoFocus: false,
  openConsoleOnError: true,
  onDestroy: resolveShutdown,
})

const keymap = createDefaultOpenTuiKeymap(renderer)

try {
  await render(
    () => (
      <LazyJiraKeymapProvider keymap={keymap}>
        <AppProviders
          config={appConfig}
          initialState={initialState}
          source={source}
          saveWorkspaceConfig={saveWorkspaceConfig}
          onExit={() => {
            if (!renderer.isDestroyed) renderer.destroy()
          }}
        >
          <App />
        </AppProviders>
      </LazyJiraKeymapProvider>
    ),
    renderer,
  )

  await shutdown
} catch (error) {
  if (!renderer.isDestroyed) renderer.destroy()
  throw error
}

function parseRuntimeEnvOrExit(argv: string[]) {
  try {
    return parseRuntimeEnv(argv)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

function selectionFromConfig(workspace: NonNullable<Awaited<ReturnType<typeof loadLazyJiraConfig>>>["devWorkspace"]): WorkspaceSelection {
  if (!workspace) throw new Error("Workspace config is required")
  return {
    project: { key: workspace.projectKey, name: workspace.projectName },
    board: { id: workspace.boardId, name: workspace.boardName, type: workspace.boardType },
  }
}
