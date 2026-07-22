import { createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { App } from "./app"
import { runAuthCli } from "./auth/cli"
import { jiraAuthSummary, loadJiraAuthConfig, loadLazyJiraConfig } from "./auth/config"
import type { AppConfig } from "./context/config"
import { LazyJiraKeymapProvider } from "./context/keymap"
import { AppProviders } from "./context/providers"
import { loadDemoWorkspace } from "./state/demo"

if (await runAuthCli(process.argv.slice(2))) process.exit(process.exitCode ?? 0)

let authLoadError: string | undefined
const savedConfig = await loadLazyJiraConfig().catch((error) => {
  authLoadError = error instanceof Error ? error.message : String(error)
  return undefined
})
const authConfig = await loadJiraAuthConfig().catch((error) => {
  authLoadError = error instanceof Error ? error.message : String(error)
  return undefined
})
const initialState = loadDemoWorkspace()
const workspaceConfig = savedConfig?.workspace
const shouldOpenProjectPicker = !workspaceConfig && (!!authConfig || initialState.demoMode)
initialState.jiraAuthReady = !!authConfig
initialState.jiraProjectReady = !!workspaceConfig
if (workspaceConfig) {
  initialState.project = { key: workspaceConfig.projectKey, name: workspaceConfig.projectName }
  initialState.board = { id: workspaceConfig.boardId, name: workspaceConfig.boardName, type: workspaceConfig.boardType }
}
initialState.authOnboarding = {
  open: !authConfig && !initialState.demoMode,
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
const appConfig: AppConfig = {
  appName: "lazyjira",
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
