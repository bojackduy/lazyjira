import { createSignal } from "solid-js"
import { createRequiredContext, type ProviderProps } from "./helper"

export type DialogContext = {
  current: () => string | undefined
  show: (name: string) => void
  clear: () => void
}

const [DialogContextProvider, useDialog] = createRequiredContext<DialogContext>("Dialog")

export { useDialog }

export function DialogProvider(props: ProviderProps) {
  const [current, setCurrent] = createSignal<string>()

  return (
    <DialogContextProvider value={{ current, show: setCurrent, clear: () => setCurrent(undefined) }}>
      {props.children}
    </DialogContextProvider>
  )
}
