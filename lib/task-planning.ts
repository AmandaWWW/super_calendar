import {
  addDays,
  addHours,
  differenceInCalendarDays,
  formatISO,
  getDay,
  isAfter,
  isBefore,
  parseISO,
  setHours,
  setMinutes,
  startOfWeek,
} from 'date-fns'
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
  domain?: 'general' | 'fitness'
  sessionsPerWeek?: number | null
  hasInjuryConstraint?: boolean
}

const FITNESS_SESSION_LIBRARY = [
  {
    title: '上肢推力量 + 低冲击有氧',
    description:
      '热身 10 分钟后进行胸肩三头主项训练，结尾补 15-20 分钟低冲击有氧。保持中等强度，避免任何会诱发髋部疼痛的动作与站姿爆发跳跃。',
    hour: 18,
    durationHours: 1.5,
  },
  {
    title: '上肢拉力量 + 核心稳定',
    description:
      '先做肩背激活与划船/下拉类主项，再加入核心稳定训练。全程控制动作节奏，避免借力和髋部过大摆动。',
    hour: 18,
    durationHours: 1.5,
  },
  {
    title: '肩臂循环 + 低冲击间歇',
    description:
      '以肩部、手臂和上背循环训练为主，最后加椭圆机/自行车等低冲击间歇。用心率和主观疲劳控制减脂节奏，不做高冲击跑跳。',
    hour: 18,
    durationHours: 1.5,
  },
  {
    title: '核心稳定 + 下肢保护性训练',
    description:
      '安排髋周稳定、臀中肌激活、腿后侧轻负荷与拉伸恢复。动作以无痛范围为准，如髋部不适明显加重，应立刻降强度并暂停。',
    hour: 10,
    durationHours: 1.25,
  },
]

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

function buildFitnessFallbackTasks({
  startDate,
  endDate,
  sessionsPerWeek = 4,
  busySlots = [],
  hasInjuryConstraint = false,
}: DefaultTaskParams): ProposedTask[] {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const tasks: ProposedTask[] = []
  const weekOffsets = [0, 1, 3, 5]
  const effectiveSessionsPerWeek = Math.max(2, Math.min(4, sessionsPerWeek ?? 4))
  const totalWeeks = Math.max(1, Math.floor(differenceInCalendarDays(end, start) / 7) + 1)

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
    const weekBase = addDays(startOfWeek(start, { weekStartsOn: 1 }), weekIndex * 7)

    for (let sessionIndex = 0; sessionIndex < effectiveSessionsPerWeek; sessionIndex += 1) {
      const template = FITNESS_SESSION_LIBRARY[sessionIndex % FITNESS_SESSION_LIBRARY.length]
      const day = addDays(weekBase, weekOffsets[sessionIndex % weekOffsets.length])

      if (isBefore(day, start) || isAfter(day, end)) {
        continue
      }

      const seedStart = setMinutes(setHours(day, template.hour), 0)
      const available = findAvailableSlot(seedStart, template.durationHours, busySlots)

      tasks.push({
        id: crypto.randomUUID(),
        title: `第 ${weekIndex + 1} 周 · 训练 ${sessionIndex + 1} · ${template.title}`,
        startTime: formatISO(available.start),
        endTime: formatISO(available.end),
        description: `${template.description}${hasInjuryConstraint ? ' 如髋部或相关部位疼痛加重，应立刻降强度或暂停。' : ''}`,
      })
    }
  }

  return tasks
}

export function buildDefaultTasks({
  goal,
  startDate,
  endDate,
  weeklyHours,
  busySlots = [],
  domain = 'general',
  sessionsPerWeek,
  hasInjuryConstraint = false,
}: DefaultTaskParams): ProposedTask[] {
  if (domain === 'fitness') {
    return buildFitnessFallbackTasks({
      goal,
      startDate,
      endDate,
      weeklyHours,
      busySlots,
      sessionsPerWeek,
      hasInjuryConstraint,
    })
  }

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

  return taskTemplates
    .map((template) => {
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
    })
    .filter((task) => parseISO(task.startTime) <= addDays(parseISO(endDate), 1))
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
