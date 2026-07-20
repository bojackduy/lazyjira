import { createRequiredContext, type ProviderProps } from "./helper"

export type ExitContext = {
  exit: () => void
}

const [ExitContextProvider, useExit] = createRequiredContext<ExitContext>("Exit")

export { useExit }

export function ExitProvider(props: ProviderProps<{ onExit: () => void }>) {
  return <ExitContextProvider value={{ exit: props.onExit }}>{props.children}</ExitContextProvider>
}
