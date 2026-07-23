export type RuntimeMode = "jira" | "demo"

export function parseRuntimeMode(argv: string[]): RuntimeMode {
  const mode = argv[0]
  if (!mode) return "jira"
  if (mode === "demo" || mode === "--demo") return "demo"
  throw new Error(`Unknown command: ${mode}\nUsage: lazyjira [demo]`)
}
