import { loadDevWorkspaceFixture } from "../workspace/dev/fixtures"
import { createInitialAppState } from "./initial"

export function loadDevWorkspaceState(projectKey = "PROJ") {
  return createInitialAppState(loadDevWorkspaceFixture(projectKey), "dev")
}
