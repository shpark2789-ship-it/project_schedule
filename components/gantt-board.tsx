"use client"

import { useMemo, useState, useTransition } from "react"
import {
  Pencil,
  Plus,
  Trash2,
  HardHat,
  ChevronDown,
  ChevronRight,
  StickyNote,
  CalendarRange,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TaskDialog } from "@/components/task-dialog"
import { deleteTask } from "@/app/actions/tasks"
import type { ScheduleTask } from "@/lib/db/schema"
import {
  CATEGORIES,
  buildTimeline,
  categoryColor,
  categoryLabel,
  durationDays,
  formatFullDate,
  overallProgress,
  parseNotes,
  taskOffsetPercent,
  taskWidthPercent,
  todayOffsetPercent,
} from "@/lib/schedule"

export function GanttBoard({ tasks }: { tasks: ScheduleTask[] }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleTask | null>(null)
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [isPending, startTransition] = useTransition()

  const timeline = useMemo(() => buildTimeline(tasks), [tasks])
  const progress = useMemo(() => overallProgress(tasks), [tasks])
  const nextSortOrder = useMemo(
    () => (tasks.length ? Math.max(...tasks.map((t) => t.sortOrder)) + 1 : 1),
    [tasks],
  )

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(task: ScheduleTask) {
    setEditing(task)
    setDialogOpen(true)
  }

  function handleDelete(id: number) {
    if (!confirm("이 공정을 삭제하시겠습니까?")) return
    startTransition(async () => {
      await deleteTask(id)
    })
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const todayOffset = timeline ? todayOffsetPercent(timeline) : null

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HardHat className="size-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-balance">공사 일정표</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                간트 차트 기반 공정 관리 · 진행률 및 담당자/협력업체 추적
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2 self-start md:self-auto">
            <Plus className="size-4" /> 공정 추가
          </Button>
        </header>

        {/* Summary */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label="전체 공정" value={`${tasks.length}건`} />
          <SummaryCard label="전체 진행률" value={`${progress}%`} />
          <SummaryCard
            label="진행 중"
            value={`${tasks.filter((t) => t.progress > 0 && t.progress < 100).length}건`}
          />
          <SummaryCard label="완료" value={`${tasks.filter((t) => t.progress >= 100).length}건`} />
        </section>

        {/* Overall progress bar */}
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
          {CATEGORIES.filter((c) => c.value !== "general").map((c) => (
            <div key={c.value} className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm" style={{ backgroundColor: c.color }} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Gantt chart */}
        {timeline ? (
          <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
            <div className="min-w-[760px]">
              {/* Month header */}
              <div className="flex border-b bg-muted/40">
                <div className="w-64 shrink-0 border-r px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                  공정명
                </div>
                <div className="relative flex flex-1">
                  {timeline.months.map((m, i) => (
                    <div
                      key={i}
                      className="border-r px-2 py-2.5 text-center text-xs font-medium text-muted-foreground last:border-r-0"
                      style={{ width: `${(m.days / timeline.totalDays) * 100}%` }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              <div className="relative">
                {/* Today marker spanning the rows area */}
                {todayOffset !== null && (
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-destructive"
                    style={{ left: `calc(16rem + (100% - 16rem) * ${todayOffset / 100})` }}
                  >
                    <span className="absolute -top-0 left-1 rounded bg-destructive px-1 py-0.5 text-[10px] font-medium text-destructive-foreground">
                      오늘
                    </span>
                  </div>
                )}

                {tasks.map((task) => {
                  const { memo, subSchedules } = parseNotes(task.notes)
                  const hasDetails = memo.trim() !== "" || subSchedules.length > 0
                  const isOpen = expanded[task.id]
                  return (
                    <div key={task.id} className="border-b last:border-b-0">
                      {/* Main row */}
                      <div className="flex items-stretch hover:bg-muted/30">
                        <div className="flex w-64 shrink-0 items-center gap-1.5 border-r px-3 py-3">
                          {hasDetails ? (
                            <button
                              onClick={() => toggleExpand(task.id)}
                              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                              aria-label="세부 일정 토글"
                            >
                              {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </button>
                          ) : (
                            <span className="size-5 shrink-0" />
                          )}
                          <span
                            className="size-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: categoryColor(task.category) }}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{task.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {task.assignee || "담당자 미정"}
                              {task.vendor ? ` · ${task.vendor}` : ""}
                            </p>
                          </div>
                        </div>

                        {/* Bar area */}
                        <div className="relative flex-1 py-3">
                          <div
                            className="group absolute top-1/2 flex h-7 -translate-y-1/2 items-center rounded-md shadow-sm"
                            style={{
                              left: `${taskOffsetPercent(task, timeline)}%`,
                              width: `${taskWidthPercent(task, timeline)}%`,
                              backgroundColor: categoryColor(task.category),
                              opacity: 0.25,
                            }}
                          />
                          {/* progress fill on top */}
                          <div
                            className="absolute top-1/2 flex h-7 -translate-y-1/2 items-center justify-end overflow-hidden rounded-md px-2"
                            style={{
                              left: `${taskOffsetPercent(task, timeline)}%`,
                              width: `${(taskWidthPercent(task, timeline) * task.progress) / 100}%`,
                              backgroundColor: categoryColor(task.category),
                            }}
                          />
                          <div
                            className="absolute top-1/2 flex h-7 -translate-y-1/2 items-center px-2"
                            style={{
                              left: `${taskOffsetPercent(task, timeline)}%`,
                              width: `${taskWidthPercent(task, timeline)}%`,
                            }}
                          >
                            <span className="truncate text-[11px] font-semibold text-foreground/80">
                              {task.progress}%
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex w-20 shrink-0 items-center justify-end gap-1 border-l px-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openEdit(task)}
                            aria-label="수정"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDelete(task.id)}
                            disabled={isPending}
                            aria-label="삭제"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isOpen && hasDetails && (
                        <div className="border-t bg-muted/20 px-4 py-3 pl-10">
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarRange className="size-3.5" />
                              {formatFullDate(task.startDate)} ~ {formatFullDate(task.endDate)}
                              {" · "}
                              {durationDays(task.startDate, task.endDate)}일
                            </span>
                            <Badge variant="secondary">{categoryLabel(task.category)}</Badge>
                          </div>

                          {memo.trim() !== "" && (
                            <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                              <StickyNote className="mt-0.5 size-4 shrink-0 text-amber-600" />
                              <p className="text-xs leading-relaxed text-foreground/90">{memo}</p>
                            </div>
                          )}

                          {subSchedules.length > 0 && (
                            <ul className="mt-3 space-y-2">
                              {subSchedules.map((sub) => (
                                <li
                                  key={sub.id}
                                  className="flex flex-col gap-1 rounded-md border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-medium">{sub.name}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {formatFullDate(sub.startDate)} ~ {formatFullDate(sub.endDate)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 sm:w-40">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                      <div
                                        className="h-full rounded-full bg-primary"
                                        style={{ width: `${sub.progress}%` }}
                                      />
                                    </div>
                                    <span className="w-9 text-right text-[11px] font-medium text-muted-foreground">
                                      {sub.progress}%
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center">
            <CalendarRange className="size-8 text-muted-foreground opacity-60" />
            <p className="mt-3 text-sm font-medium">등록된 공정이 없습니다</p>
            <p className="mt-1 text-xs text-muted-foreground">상단의 “공정 추가” 버튼으로 첫 공정을 등록하세요.</p>
            <Button onClick={openCreate} className="mt-4 gap-2">
              <Plus className="size-4" /> 공정 추가
            </Button>
          </div>
        )}
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editing}
        nextSortOrder={nextSortOrder}
      />
    </main>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

