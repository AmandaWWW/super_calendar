import { addDays, addHours, formatISO, getDay, isAfter, isBefore, parseISO, setHours, setMinutes } from 'date-fns'
import type { CalendarEvent, ConflictRecord, ProposedTask } from '@/lib/calendar-types'

type BusySlot = {
  start: string
  end: string
  title?: string
  id?: string
}

type DefaultTaskParams = {
  goal: string
  startDate: string
  endDate: string
  weeklyHours: number
  busySlots?: BusySlot[]
}

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

function hasOverlap(start: Date, end: Date, slots: BusySlot[]) {
  return slots.some((slot) => {
    const slotStart = parseISO(slot.start)
    const slotEnd = parseISO(slot.end)

    return isBefore(start, slotEnd) && isAfter(end, slotStart)
  })
}

function findAvailableSlot(start: Date, durationHours: number, slots: BusySlot[]) {
  let cursor = start

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const end = addHours(cursor, durationHours)

    if (!hasOverlap(cursor, end, slots)) {
      return { start: cursor, end }
    }

    const nextHour = addHours(cursor, 1)
    if (nextHour.getHours() >= 20) {
      const nextDay = addDays(cursor, 1)
      cursor = setMinutes(setHours(nextDay, 9), 0)
    } else {
      cursor = nextHour
    }
  }

  return {
    start,
    end: addHours(start, durationHours),
  }
}

export function buildDefaultTasks({
  goal,
  startDate,
  endDate,
  weeklyHours,
  busySlots = [],
}: DefaultTaskParams): ProposedTask[] {
  const start = parseISO(startDate)
  const taskTemplates = [
    {
      title: '目标拆解与验收定义',
      description: `围绕「${goal}」拆分关键里程碑、定义完成标准，并列出风险与依赖。`,
      dayOffset: 0,
      hour: 9,
      durationHours: 2,
    },
    {
      title: '核心模块推进',
      description: '进入最关键的执行区段，优先完成最能验证结果的核心块。',
      dayOffset: 1,
      hour: 14,
      durationHours: Math.max(2, Math.min(4, Math.ceil(weeklyHours / 4))),
    },
    {
      title: '中段校准与问题清单',
      description: '检查实际进度、暴露阻塞项，必要时降维拆解或重排优先级。',
      dayOffset: 3,
      hour: 10,
      durationHours: 2,
    },
    {
      title: '交付整理与复盘',
      description: '输出交付物、整理文档，并做一轮复盘保证可持续推进。',
      dayOffset: 5,
      hour: 16,
      durationHours: 2,
    },
  ]

  return taskTemplates.map((template, index) => {
    const baseDay = addDays(start, template.dayOffset)
    const adjustedDay =
      getDay(baseDay) === 0 ? addDays(baseDay, 1) : getDay(baseDay) === 6 ? addDays(baseDay, 2) : baseDay
    const seedStart = setMinutes(setHours(adjustedDay, template.hour), 0)
    const available = findAvailableSlot(seedStart, template.durationHours, busySlots)

    return {
      id: crypto.randomUUID(),
      title: template.title,
      startTime: formatISO(available.start),
      endTime: formatISO(available.end),
      description: template.description,
    }
  }).filter((task) => parseISO(task.startTime) <= addDays(parseISO(endDate), 1))
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
