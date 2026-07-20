import { createContext, useContext, type ParentProps } from "solid-js"

export function createRequiredContext<T>(name: string) {
  const context = createContext<T>()

  function useRequiredContext() {
    const value = useContext(context)
    if (value === undefined) throw new Error(`${name} context must be used within its provider`)
    return value
  }

  return [context.Provider, useRequiredContext] as const
}

export type ProviderProps<T extends Record<string, unknown> = Record<string, unknown>> = ParentProps<T>
