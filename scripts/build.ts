import solidPlugin from "@opentui/solid/bun-plugin"
import { rm } from "node:fs/promises"

await rm("dist", { recursive: true, force: true })

const result = await Bun.build({
  entrypoints: ["src/main.tsx"],
  outdir: "dist",
  target: "bun",
  plugins: [solidPlugin],
  external: ["@opentui/core-*"],
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
