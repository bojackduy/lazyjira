import { useAppState } from "../context/app-state"
import { boardModeForBoard } from "../state/routes"
import { BoardSurface } from "../ui/board"

export function BoardRoute() {
  const { state } = useAppState()
  return <BoardSurface mode={boardModeForBoard(state.board)} />
}
