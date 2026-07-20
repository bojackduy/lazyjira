import { createRequiredContext, type ProviderProps } from "./helper"

export type Theme = {
  background: string
  panel: string
  border: string
  borderActive: string
  text: string
  textMuted: string
  textSubtle: string
  selected: string
  selectedText: string
  accent: string
  success: string
  warning: string
  danger: string
}

export const defaultTheme: Theme = {
  background: "#0B1020",
  panel: "#111827",
  border: "#334155",
  borderActive: "#38BDF8",
  text: "#E5E7EB",
  textMuted: "#94A3B8",
  textSubtle: "#64748B",
  selected: "#1D4ED8",
  selectedText: "#F8FAFC",
  accent: "#38BDF8",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
}

const [ThemeContextProvider, useTheme] = createRequiredContext<Theme>("Theme")

export { useTheme }

export function ThemeProvider(props: ProviderProps<{ value?: Theme }>) {
  return <ThemeContextProvider value={props.value ?? defaultTheme}>{props.children}</ThemeContextProvider>
}
