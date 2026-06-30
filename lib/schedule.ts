import type { ScheduleTask } from "@/lib/db/schema"

export const CATEGORIES = [
  { value: "준비", label: "준비", color: "var(--chart-5)" },
  { value: "토목", label: "토목", color: "var(--chart-3)" },
  { value: "구조", label: "구조", color: "var(--chart-1)" },
  { value: "설비", label: "설비", color: "var(--chart-2)" },
  { value: "마감", label: "마감", color: "var(--chart-4)" },
  { value: "준공", label: "준공", color: "var(--chart-5)" },
  { value: "general", label: "기타", color: "var(--muted-foreground)" },
] as const

export type SubSchedule = {
  id: string
  name: string
  startDate: string
  endDate: string
  progress: number
}

export type ParsedNotes = {
  memo: string
  subSchedules: SubSchedule[]
}

/** notes 컬럼은 메모와 세부 일정을 함께 담은 JSON 문자열로 저장된다. 구버전 평문 메모도 호환한다. */
export function parseNotes(notes: string | null | undefined): ParsedNotes {
  if (!notes) return { memo: "", subSchedules: [] }
  const trimmed = notes.trim()
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed)
      return {
        memo: typeof parsed.notes === "string" ? parsed.notes : "",
        subSchedules: Array.isArray(parsed.subSchedules) ? (parsed.subSchedules as SubSchedule[]) : [],
      }
    } catch {
      // fall through to plain-text handling
    }
  }
  return { memo: notes, subSchedules: [] }
}

export function packNotes(memo: string, subSchedules: SubSchedule[]): string {
  return JSON.stringify({ notes: memo.trim(), subSchedules })
}

export function categoryColor(category: string) {
  return CATEGORIES.find((c) => c.value === category)?.color ?? "var(--muted-foreground)"
}

export function categoryLabel(category: string) {
  return CATEGORIES.find((c) => c.value === category)?.label ?? category
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

export function parseDate(value: string): Date {
  // value is YYYY-MM-DD; build a UTC date to avoid timezone drift
  const [y, m, d] = value.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function formatDate(value: string): string {
  const d = parseDate(value)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`
}

export function formatFullDate(value: string): string {
  const d = parseDate(value)
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`
}

export function durationDays(start: string, end: string): number {
  return diffDays(parseDate(start), parseDate(end)) + 1
}

export type TimelineMonth = {
  label: string
  /** number of days this month spans within the timeline */
  days: number
}

export type Timeline = {
  start: Date
  end: Date
  totalDays: number
  months: TimelineMonth[]
}

export function buildTimeline(tasks: ScheduleTask[]): Timeline | null {
  if (tasks.length === 0) return null
  let min = parseDate(tasks[0].startDate)
  let max = parseDate(tasks[0].endDate)
  for (const t of tasks) {
    const s = parseDate(t.startDate)
    const e = parseDate(t.endDate)
    if (s < min) min = s
    if (e > max) max = e
  }
  // pad a few days on each side and snap to month boundaries
  const start = new Date(Date.UTC(min.getUTCFullYear(), min.getUTCMonth(), 1))
  const end = new Date(Date.UTC(max.getUTCFullYear(), max.getUTCMonth() + 1, 0))
  const totalDays = diffDays(start, end) + 1

  const months: TimelineMonth[] = []
  let cursor = new Date(start)
  while (cursor <= end) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
    const segEnd = monthEnd < end ? monthEnd : end
    months.push({
      label: `${cursor.getUTCFullYear()}.${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
      days: diffDays(cursor, segEnd) + 1,
    })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }

  return { start, end, totalDays, months }
}

export function taskOffsetPercent(task: ScheduleTask, timeline: Timeline): number {
  return (diffDays(timeline.start, parseDate(task.startDate)) / timeline.totalDays) * 100
}

export function taskWidthPercent(task: ScheduleTask, timeline: Timeline): number {
  return (durationDays(task.startDate, task.endDate) / timeline.totalDays) * 100
}

export function todayOffsetPercent(timeline: Timeline): number | null {
  const now = new Date()
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  if (today < timeline.start || today > timeline.end) return null
  return (diffDays(timeline.start, today) / timeline.totalDays) * 100
}

export function overallProgress(tasks: ScheduleTask[]): number {
  if (tasks.length === 0) return 0
  let weighted = 0
  let total = 0
  for (const t of tasks) {
    const dur = durationDays(t.startDate, t.endDate)
    weighted += dur * t.progress
    total += dur
  }
  return total === 0 ? 0 : Math.round(weighted / total)
}
