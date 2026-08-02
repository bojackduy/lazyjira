export type RuntimeEnv = "dev" | "prod"

export function isVersionRequest(argv: string[]) {
  return argv[0] === "--version" || argv[0] === "-v"
}

export function parseRuntimeEnv(argv: string[]): RuntimeEnv {
  const env = argv[0]
  if (!env) return "prod"
  if (env === "dev" || env === "prod") return env
  throw new Error(`Unknown runtime environment: ${env}\nUsage: lazyjira [dev|prod]`)
}
