import { createRequiredContext, type ProviderProps } from "./helper"
import type { JiraAuthSummary } from "../auth/config"
import type { RuntimeMode } from "../runtime/mode"

export type AppConfig = {
  appName: string
  runtimeMode: RuntimeMode
  demoMode: boolean
  jira?: JiraAuthSummary
}

const [ConfigContextProvider, useConfig] = createRequiredContext<AppConfig>("Config")

export { useConfig }

export function ConfigProvider(props: ProviderProps<{ value: AppConfig }>) {
  return <ConfigContextProvider value={props.value}>{props.children}</ConfigContextProvider>
}
