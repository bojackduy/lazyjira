import { createCliRenderer } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { render } from "@opentui/solid"
import { App } from "./app"
import { runAuthCli } from "./auth/cli"
import { jiraAuthSummary, loadJiraAuthConfig } from "./auth/config"
import type { AppConfig } from "./context/config"
import { LazyJiraKeymapProvider } from "./context/keymap"
import { AppProviders } from "./context/providers"
import { loadDemoWorkspace } from "./state/demo"

if (await runAuthCli(process.argv.slice(2))) process.exit(process.exitCode ?? 0)

let authLoadError: string | undefined
const authConfig = await loadJiraAuthConfig().catch((error) => {
  authLoadError = error instanceof Error ? error.message : String(error)
  return undefined
})
const initialState = loadDemoWorkspace()
initialState.jiraAuthReady = !!authConfig
initialState.authOnboarding = {
  open: !authConfig,
  step: "baseUrl",
  baseUrl: authConfig?.baseUrl ?? "",
  email: authConfig?.email ?? "",
  apiToken: "",
  saving: false,
  error: authLoadError,
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
