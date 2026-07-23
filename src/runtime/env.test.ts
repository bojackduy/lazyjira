import { describe, expect, test } from "bun:test"
import { parseRuntimeEnv } from "./env"

describe("runtime env", () => {
  test("defaults to prod", () => {
    expect(parseRuntimeEnv([])).toBe("prod")
  })

  test("supports explicit dev and prod", () => {
    expect(parseRuntimeEnv(["dev"])).toBe("dev")
    expect(parseRuntimeEnv(["prod"])).toBe("prod")
  })

  test("rejects unknown environments", () => {
    expect(() => parseRuntimeEnv(["demo"])).toThrow("Unknown runtime environment: demo")
  })
})
