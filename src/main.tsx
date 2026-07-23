import { createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { App } from "./app"
import { runAuthCli } from "./auth/cli"
import { jiraAuthSummary, loadJiraAuthConfig, loadLazyJiraConfig, saveDemoWorkspaceConfig, saveJiraWorkspaceConfig } from "./auth/config"
import type { AppConfig } from "./context/config"
import { LazyJiraKeymapProvider } from "./context/keymap"
import { AppProviders } from "./context/providers"
import { createApiDiscoverySource, createMockDiscoverySource } from "./jira/discovery"
import { parseRuntimeMode } from "./runtime/mode"
import { loadDemoWorkspace } from "./state/demo"

const argv = process.argv.slice(2)
if (await runAuthCli(argv)) process.exit(process.exitCode ?? 0)

const runtimeMode = parseRuntimeModeOrExit(argv)

let authLoadError: string | undefined
const savedConfig = await loadLazyJiraConfig().catch((error) => {
  authLoadError = error instanceof Error ? error.message : String(error)
  return undefined
})
const authConfig = runtimeMode === "jira" ? await loadJiraAuthConfig().catch((error) => {
  authLoadError = error instanceof Error ? error.message : String(error)
  return undefined
}) : undefined
const initialState = loadDemoWorkspace()
initialState.demoMode = runtimeMode === "demo"
const workspaceConfig = runtimeMode === "demo" ? savedConfig?.demoWorkspace : savedConfig?.workspace
const shouldOpenProjectPicker = !workspaceConfig && (runtimeMode === "demo" || !!authConfig)
initialState.jiraAuthReady = !!authConfig
initialState.jiraProjectReady = !!workspaceConfig
if (workspaceConfig) {
  initialState.project = { key: workspaceConfig.projectKey, name: workspaceConfig.projectName }
  initialState.board = { id: workspaceConfig.boardId, name: workspaceConfig.boardName, type: workspaceConfig.boardType }
}
initialState.authOnboarding = {
  open: runtimeMode === "jira" && !authConfig,
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
  loading: false,
  saving: false,
  selectedIndex: 0,
  projects: [],
  boards: [],
}
const discovery = runtimeMode === "demo" ? createMockDiscoverySource() : createApiDiscoverySource()
const saveWorkspaceConfig = runtimeMode === "demo" ? saveDemoWorkspaceConfig : saveJiraWorkspaceConfig
const appConfig: AppConfig = {
  appName: "lazyjira",
  runtimeMode,
  demoMode: initialState.demoMode,
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
          discovery={discovery}
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

function parseRuntimeModeOrExit(argv: string[]) {
  try {
    return parseRuntimeMode(argv)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
