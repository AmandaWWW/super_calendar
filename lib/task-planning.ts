import { isAfter, isBefore, parseISO } from 'date-fns'
import type { CalendarEvent, ConflictRecord, ProposedTask } from '@/lib/calendar-types'

export function taskToCalendarEvent(task: ProposedTask): CalendarEvent {
  return {
    id: task.id,
    title: task.title,
    start: task.startTime,
    end: task.endTime,
    extendedProps: {
      description: task.description,
      source: 'proposed-task',
    },
  }
}

export function detectTaskConflicts(tasks: ProposedTask[], events: CalendarEvent[]): ConflictRecord[] {
  return tasks.flatMap((task) => {
    const taskStart = parseISO(task.startTime)
    const taskEnd = parseISO(task.endTime)

    return events
      .filter((event) => event.start && event.end)
      .filter((event) => {
        const eventStart = parseISO(String(event.start))
        const eventEnd = parseISO(String(event.end))

        return isBefore(taskStart, eventEnd) && isAfter(taskEnd, eventStart)
      })
      .map((event) => ({
        taskId: task.id,
        taskTitle: task.title,
        eventId: String(event.id ?? event.title ?? crypto.randomUUID()),
        eventTitle: String(event.title ?? '已有日程'),
        startTime: task.startTime,
        endTime: task.endTime,
      }))
  })
}
