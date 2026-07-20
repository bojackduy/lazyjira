import { createSignal } from "solid-js"
import { createRequiredContext, type ProviderProps } from "./helper"

export type ToastContext = {
  message: () => string | undefined
  show: (message: string) => void
  clear: () => void
}

const [ToastContextProvider, useToast] = createRequiredContext<ToastContext>("Toast")

export { useToast }

export function ToastProvider(props: ProviderProps) {
  const [message, setMessage] = createSignal<string>()

  return (
    <ToastContextProvider value={{ message, show: setMessage, clear: () => setMessage(undefined) }}>
      {props.children}
    </ToastContextProvider>
  )
}
