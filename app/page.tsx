import { GanttBoard } from "@/components/gantt-board"
import { getTasks } from "@/app/actions/tasks"

export const dynamic = "force-dynamic"

export default async function Page() {
  const tasks = await getTasks()
  return <GanttBoard tasks={tasks} />
}
