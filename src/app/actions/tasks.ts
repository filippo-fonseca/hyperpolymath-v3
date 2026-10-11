"use server";

import { z } from "zod";
import { completeTask, createTask, deleteTask, reopenTask, updateTask, type TaskInput } from "@/server/tasks";
import { cancelReminder, setReminder, snoozeReminder, type ReminderInput } from "@/server/reminders";
import { recurrenceSchema } from "@/lib/recurrence";
import { scheduleSchema } from "@/lib/schedule";
import { asUser } from "./run";

const id = z.string().uuid();
const taskInput = z
  .object({
    title: z.string().max(500),
    notes: z.string().max(20000).nullable(),
    status: z.enum(["todo", "doing", "done"]),
    priority: z.number().int().min(0).max(3),
    list: z.string().max(120).nullable(),
    project: id.nullable(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable(),
    recurrence: recurrenceSchema.nullable(),
  })
  .partial();

export async function createTaskAction(input: TaskInput & { title: string }) {
  return asUser((ctx) => createTask(ctx, { ...taskInput.parse(input), title: String(input.title) }));
}

export async function updateTaskAction(taskId: string, input: TaskInput) {
  return asUser((ctx) => updateTask(ctx, id.parse(taskId), taskInput.parse(input)));
}

export async function completeTaskAction(taskId: string) {
  return asUser((ctx) => completeTask(ctx, id.parse(taskId)));
}

export async function reopenTaskAction(taskId: string) {
  return asUser((ctx) => reopenTask(ctx, id.parse(taskId)));
}

export async function deleteTaskAction(taskId: string) {
  return asUser((ctx) => deleteTask(ctx, id.parse(taskId)));
}

const reminderInput = z.object({
  task_id: id.nullable().optional(),
  message: z.string().max(500).nullable().optional(),
  schedule: scheduleSchema,
  until: z.enum(["done", "date", "count", "once"]).optional(),
  until_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  count: z.number().int().min(1).max(1000).nullable().optional(),
});

export async function setReminderAction(input: ReminderInput) {
  return asUser(async (ctx) => {
    const r = await setReminder(ctx, reminderInput.parse(input));
    return { id: r.id, describes: r.describes, first_fire_at: r.first_fire_at };
  });
}

export async function cancelReminderAction(reminderId: string) {
  return asUser((ctx) => cancelReminder(ctx, id.parse(reminderId)));
}

export async function snoozeReminderAction(reminderId: string, minutes: number) {
  return asUser(async (ctx) => {
    await snoozeReminder(ctx, id.parse(reminderId), { minutes: z.number().int().min(5).max(10080).parse(minutes) });
    return true;
  });
}
