"use client"

import { useState, useTransition, useEffect } from "react"
import { Plus, Trash2, CalendarRange } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CATEGORIES, packNotes, parseNotes, type SubSchedule } from "@/lib/schedule"
import { createTask, updateTask, type TaskInput } from "@/app/actions/tasks"
import type { ScheduleTask } from "@/lib/db/schema"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: ScheduleTask | null
  nextSortOrder: number
}

export function TaskDialog({ open, onOpenChange, task, nextSortOrder }: Props) {
  const isEdit = Boolean(task)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // 메모와 세부 일정의 상태 관리
  const [notesText, setNotesText] = useState("")
  const [subSchedules, setSubSchedules] = useState<SubSchedule[]>([])

  // 다이얼로그가 열리거나 task가 변경될 때 상태 초기화
  useEffect(() => {
    if (open) {
      setError(null)
      if (task) {
        const { memo, subSchedules: subs } = parseNotes(task.notes)
        setNotesText(memo)
        setSubSchedules(subs)
      } else {
        // 공정 추가 시 기본값 초기화
        setNotesText("")
        setSubSchedules([])
      }
    }
  }, [open, task])

  // 세부 일정 목록에 새 슬롯 추가
  function handleAddSubSchedule() {
    // 기본 시작일과 종료일은 메인 공정의 입력값을 참고할 수 있도록 함
    const form = document.querySelector("form")
    const mainStart = form ? String(new FormData(form).get("startDate") || "") : ""
    const mainEnd = form ? String(new FormData(form).get("endDate") || "") : ""

    setSubSchedules([
      ...subSchedules,
      {
        id: crypto.randomUUID(),
        name: "",
        startDate: mainStart,
        endDate: mainEnd,
        progress: 0,
      },
    ])
  }

  // 세부 일정 개별 필드 업데이트
  function handleUpdateSubSchedule(id: string, field: keyof SubSchedule, value: string | number) {
    setSubSchedules(
      subSchedules.map((sub) => (sub.id === id ? { ...sub, [field]: value } : sub))
    )
  }

  // 세부 일정 개별 삭제
  function handleDeleteSubSchedule(id: string) {
    setSubSchedules(subSchedules.filter((sub) => sub.id !== id))
  }

  function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") || "").trim()
    const category = String(formData.get("category") || "구조")
    const assignee = String(formData.get("assignee") || "").trim() || null
    const vendor = String(formData.get("vendor") || "").trim() || null
    const startDate = String(formData.get("startDate") || "")
    const endDate = String(formData.get("endDate") || "")
    const progress = Number(formData.get("progress") || 0)

    if (!name) return setError("공정명을 입력하세요.")
    if (!startDate || !endDate) return setError("시작일과 종료일을 입력하세요.")
    if (endDate < startDate) return setError("종료일은 시작일 이후여야 합니다.")

    // 세부 일정 유효성 검사 (공정명이 채워진 일정만 필터링)
    const validSubSchedules = subSchedules
      .map((s) => ({ ...s, name: s.name.trim() }))
      .filter((s) => s.name !== "")

    for (const sub of validSubSchedules) {
      if (!sub.startDate || !sub.endDate) {
        return setError(`세부공정 [${sub.name}]의 시작일과 종료일을 모두 입력하세요.`)
      }
      if (sub.endDate < sub.startDate) {
        return setError(`세부공정 [${sub.name}]의 종료일은 시작일 이후여야 합니다.`)
      }
    }

    // 메모 내용과 세부 일정을 단일 JSON 문자열로 패키징하여 notes 컬럼에 저장
    const input: TaskInput = {
      name,
      category,
      assignee,
      vendor,
      startDate,
      endDate,
      progress,
      sortOrder: task?.sortOrder ?? nextSortOrder,
      notes: packNotes(notesText, validSubSchedules),
    }

    setError(null)
    startTransition(async () => {
      if (isEdit && task) {
        await updateTask(task.id, input)
      } else {
        await createTask(input)
      }
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "공정 수정" : "공정 추가"}</DialogTitle>
          <DialogDescription>
            공사 일정의 세부 정보를 입력하세요. 하위 세부 일정 및 중요 메모를 함께 저장할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="grid gap-4 mt-2">
          {/* 공정명 */}
          <div className="grid gap-2">
            <Label htmlFor="name">공정명</Label>
            <Input id="name" name="name" defaultValue={task?.name ?? ""} placeholder="예: 착공 및 가설공사" />
          </div>

          {/* 공종 & 진행률 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="category">공종</Label>
              <Select name="category" defaultValue={task?.category ?? "구조"}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="공종 선택" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="progress">메인 진행률 (%)</Label>
              <Input
                id="progress"
                name="progress"
                type="number"
                min={0}
                max={100}
                defaultValue={task?.progress ?? 0}
              />
            </div>
          </div>

          {/* 메인 일정 기간 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="startDate">시작일</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={task?.startDate ?? ""} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endDate">종료일</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={task?.endDate ?? ""} />
            </div>
          </div>

          {/* 담당자 & 협력업체 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="assignee">담당자</Label>
              <Input id="assignee" name="assignee" defaultValue={task?.assignee ?? ""} placeholder="예: 박지훈" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor">협력업체</Label>
              <Input id="vendor" name="vendor" defaultValue={task?.vendor ?? ""} placeholder="예: 대성철강" />
            </div>
          </div>

          {/* 중요 메모 작성 폼 */}
          <div className="grid gap-2">
            <Label htmlFor="notesText">⚠️ 중요 메모 및 특이사항</Label>
            <textarea
              id="notesText"
              rows={2}
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="예: 민원 우려 지역, 기후 상황에 따른 일정 유동성 고려 필수"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* 동적 세부 일정 추가 영역 */}
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">하위 세부 일정 목록 ({subSchedules.length})</Label>
                <p className="text-[10px] text-muted-foreground">하나의 공정 아래 복수의 세부 공정을 등록합니다.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSubSchedule}
                className="h-8 gap-1.5 text-xs font-medium border-primary/40 hover:bg-primary/5 text-primary hover:text-primary-foreground"
              >
                <Plus className="size-3.5" /> 세부 일정 추가
              </Button>
            </div>

            {subSchedules.length === 0 ? (
              <div className="text-center py-4 rounded-md border border-dashed bg-card/50">
                <CalendarRange className="size-5 text-muted-foreground mx-auto mb-1 opacity-60" />
                <p className="text-xs text-muted-foreground">세부 일정이 없습니다. 필요한 경우 상단 버튼으로 추가하세요.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {subSchedules.map((sub, idx) => (
                  <div key={sub.id} className="relative space-y-2 rounded-lg border bg-card p-3 shadow-xs">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDeleteSubSchedule(sub.id)}
                      aria-label="세부 일정 삭제"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>

                    <div className="grid gap-1.5 pr-8">
                      <Label className="text-[11px] font-medium text-muted-foreground">세부 공정명</Label>
                      <Input
                        placeholder="예: 가설 울타리 설치 및 라인마킹"
                        value={sub.name}
                        className="h-8 text-xs"
                        onChange={(e) => handleUpdateSubSchedule(sub.id, "name", e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="grid gap-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">시작일</Label>
                        <Input
                          type="date"
                          value={sub.startDate}
                          className="h-8 text-xs"
                          onChange={(e) => handleUpdateSubSchedule(sub.id, "startDate", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">종료일</Label>
                        <Input
                          type="date"
                          value={sub.endDate}
                          className="h-8 text-xs"
                          onChange={(e) => handleUpdateSubSchedule(sub.id, "endDate", e.target.value)}
                        />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">진행률 (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={sub.progress}
                          className="h-8 text-xs"
                          onChange={(e) => handleUpdateSubSchedule(sub.id, "progress", Number(e.target.value || 0))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}

          <DialogFooter className="pt-2 border-t border-border/50">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중..." : isEdit ? "수정 완료" : "공정 추가"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

