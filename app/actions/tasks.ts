"use server"

import { db } from "@/lib/db"
import { scheduleTasks, type NewScheduleTask } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getTasks() {
  return db.select().from(scheduleTasks).orderBy(asc(scheduleTasks.sortOrder), asc(scheduleTasks.startDate))
}

export type TaskInput = {
  name: string
  category: string
  assignee?: string | null
  vendor?: string | null
  startDate: string
  endDate: string
  progress: number
  sortOrder?: number
  notes?: string | null
}

export async function createTask(input: TaskInput) {
  const values: NewScheduleTask = {
    name: input.name,
    category: input.category,
    assignee: input.assignee || null,
    vendor: input.vendor || null,
    startDate: input.startDate,
    endDate: input.endDate,
    progress: Math.max(0, Math.min(100, Math.round(input.progress))),
    sortOrder: input.sortOrder ?? 0,
    notes: input.notes ?? null,
  }
  await db.insert(scheduleTasks).values(values)
  revalidatePath("/")
}

export async function updateTask(id: number, input: TaskInput) {
  await db
    .update(scheduleTasks)
    .set({
      name: input.name,
      category: input.category,
      assignee: input.assignee || null,
      vendor: input.vendor || null,
      startDate: input.startDate,
      endDate: input.endDate,
      progress: Math.max(0, Math.min(100, Math.round(input.progress))),
      sortOrder: input.sortOrder ?? 0,
      notes: input.notes ?? null,
    })
    .where(eq(scheduleTasks.id, id))
  revalidatePath("/")
}

export async function deleteTask(id: number) {
  await db.delete(scheduleTasks).where(eq(scheduleTasks.id, id))
  revalidatePath("/")
}
