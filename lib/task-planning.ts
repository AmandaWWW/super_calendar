import {
  addDays,
  addHours,
  addMinutes,
  differenceInCalendarDays,
  formatISO,
  isAfter,
  isBefore,
  parseISO,
  setHours,
  setMinutes,
  startOfWeek,
} from 'date-fns'
import type { CalendarEvent, ConflictRecord, ProposedTask } from '@/lib/calendar-types'

export type PlanDomain = 'general' | 'fitness' | 'study' | 'errand' | 'project' | 'career' | 'content'

type BusySlot = {
  start: string
  end: string
  title?: string
  id?: string
}

export type RecurringTemplateSession = {
  title: string
  description: string
  dayOffset: number
  startHour: number
  durationMinutes: number
}

export type PhaseTemplateTask = {
  title: string
  description: string
  weekOffset: number
  dayOffset: number
  startHour: number
  durationMinutes: number
}

export type PhaseTemplatePhase = {
  title: string
  weekStart: number
  weekEnd: number
  tasks: PhaseTemplateTask[]
}

type DefaultTaskParams = {
  goal: string
  startDate: string
  endDate: string
  weeklyHours: number
  busySlots?: BusySlot[]
  domain?: PlanDomain
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

const STUDY_EXAM_SESSIONS: RecurringTemplateSession[] = [
  {
    title: '重点知识输入',
    description: '集中补最薄弱的知识点，做一轮结构化笔记和例题梳理。',
    dayOffset: 0,
    startHour: 19,
    durationMinutes: 90,
  },
  {
    title: '定向练习',
    description: '围绕当前弱项完成一组高质量练习，记录错因与耗时。',
    dayOffset: 1,
    startHour: 19,
    durationMinutes: 90,
  },
  {
    title: '输出与复述',
    description: '把本周重点内容做一次口头或书面输出，检验真正掌握程度。',
    dayOffset: 3,
    startHour: 19,
    durationMinutes: 90,
  },
  {
    title: '套题或阶段测验',
    description: '按真实限制完成一轮整套训练，并整理错题和复盘结论。',
    dayOffset: 5,
    startHour: 10,
    durationMinutes: 150,
  },
  {
    title: '错题回收与下周预热',
    description: '复盘高频失误和薄弱点，为下一周安排重点修正动作。',
    dayOffset: 6,
    startHour: 15,
    durationMinutes: 90,
  },
]

const STUDY_GENERIC_SESSIONS: RecurringTemplateSession[] = [
  {
    title: '知识学习块',
    description: '推进核心知识输入，控制节奏并整理重点摘要。',
    dayOffset: 0,
    startHour: 19,
    durationMinutes: 90,
  },
  {
    title: '练习与应用块',
    description: '把本周学习内容转化为题目、案例或练习输出。',
    dayOffset: 2,
    startHour: 19,
    durationMinutes: 90,
  },
  {
    title: '复盘修正块',
    description: '统一回顾错漏点，形成下一周的重点修正清单。',
    dayOffset: 5,
    startHour: 10,
    durationMinutes: 120,
  },
]

const CAREER_SESSIONS: RecurringTemplateSession[] = [
  {
    title: '核心技能补课',
    description: '集中补当前转岗所缺的关键技能，并保留可复用笔记。',
    dayOffset: 0,
    startHour: 19,
    durationMinutes: 120,
  },
  {
    title: '项目实战推进',
    description: '围绕一个可展示项目推进实操，沉淀能写进作品集的产出。',
    dayOffset: 2,
    startHour: 19,
    durationMinutes: 120,
  },
  {
    title: '简历或作品集优化',
    description: '更新简历、项目表达和案例包装，确保能立即投递。',
    dayOffset: 4,
    startHour: 19,
    durationMinutes: 90,
  },
  {
    title: '投递与面试复盘',
    description: '批量投递或复盘面试表现，迭代下周的准备重点。',
    dayOffset: 6,
    startHour: 10,
    durationMinutes: 150,
  },
]

const CONTENT_SESSIONS: RecurringTemplateSession[] = [
  {
    title: '选题与脚本',
    description: '确认本周内容主题、标题和脚本骨架，避免临时起稿。',
    dayOffset: 0,
    startHour: 19,
    durationMinutes: 90,
  },
  {
    title: '素材制作',
    description: '完成拍摄、录屏、整理素材或设计主视觉等制作动作。',
    dayOffset: 2,
    startHour: 19,
    durationMinutes: 120,
  },
  {
    title: '编辑与发布',
    description: '完成剪辑、排版、封面和文案，按计划发出当周内容。',
    dayOffset: 4,
    startHour: 19,
    durationMinutes: 120,
  },
  {
    title: '数据复盘与互动',
    description: '回收评论和数据反馈，筛出可继续放大的选题方向。',
    dayOffset: 6,
    startHour: 15,
    durationMinutes: 90,
  },
]

const GROCERY_SESSIONS: RecurringTemplateSession[] = [
  {
    title: '一周菜单与清单',
    description: '先盘点库存，再定本周菜单和购物清单，压住预算与浪费。',
    dayOffset: 0,
    startHour: 20,
    durationMinutes: 45,
  },
  {
    title: '集中采购',
    description: '一次性完成主采购，优先买高频食材和可复用半成品。',
    dayOffset: 5,
    startHour: 10,
    durationMinutes: 90,
  },
  {
    title: '备餐与分装',
    description: '处理洗切、腌制、分装和基础熟制，缩短工作日晚饭时间。',
    dayOffset: 5,
    startHour: 15,
    durationMinutes: 120,
  },
  {
    title: '中周补货与调整',
    description: '检查消耗最快的食材，补齐蔬菜蛋白并微调剩余菜单。',
    dayOffset: 3,
    startHour: 20,
    durationMinutes: 40,
  },
]

const HOUSEHOLD_SESSIONS: RecurringTemplateSession[] = [
  {
    title: '厨房深清与台面回收',
    description: '集中处理灶台、水槽、台面和高频小家电周边杂物。',
    dayOffset: 0,
    startHour: 20,
    durationMinutes: 40,
  },
  {
    title: '衣柜或抽屉整理',
    description: '按一小块区域整理收纳，保留可持续维护的摆放规则。',
    dayOffset: 2,
    startHour: 20,
    durationMinutes: 40,
  },
  {
    title: '书桌与公共区重置',
    description: '收回桌面堆积、归位文件杂物，并处理一轮可丢弃物。',
    dayOffset: 5,
    startHour: 10,
    durationMinutes: 40,
  },
]

const ROUTINE_SESSIONS: RecurringTemplateSession[] = [
  {
    title: '晚间收束流程',
    description: '固定下班后的关机、洗漱和入睡前准备动作，逐步提前睡点。',
    dayOffset: 0,
    startHour: 22,
    durationMinutes: 45,
  },
  {
    title: '运动或恢复块',
    description: '安排一次可坚持的轻中等强度运动，优先稳定节奏而非刷强度。',
    dayOffset: 2,
    startHour: 19,
    durationMinutes: 60,
  },
  {
    title: '周复盘与下周校准',
    description: '回顾睡眠、精神状态和执行率，微调下一周目标。',
    dayOffset: 6,
    startHour: 20,
    durationMinutes: 45,
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

type ExpandRecurringTemplateParams = {
  startDate: string
  endDate: string
  sessions: RecurringTemplateSession[]
  busySlots?: BusySlot[]
  weekStartsOn?: 0 | 1
}

export function expandRecurringTemplateToTasks({
  startDate,
  endDate,
  sessions,
  busySlots = [],
  weekStartsOn = 1,
}: ExpandRecurringTemplateParams): ProposedTask[] {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const tasks: ProposedTask[] = []
  const totalWeeks = Math.max(1, Math.floor(differenceInCalendarDays(end, start) / 7) + 1)
  const weekAnchor = startOfWeek(start, { weekStartsOn })
  const sortedSessions = [...sessions].sort((left, right) => {
    if (left.dayOffset === right.dayOffset) {
      return left.startHour - right.startHour
    }

    return left.dayOffset - right.dayOffset
  })

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
    const currentWeekStart = addDays(weekAnchor, weekIndex * 7)

    for (let sessionIndex = 0; sessionIndex < sortedSessions.length; sessionIndex += 1) {
      const session = sortedSessions[sessionIndex]
      const day = addDays(currentWeekStart, session.dayOffset)

      if (isBefore(day, start) || isAfter(day, end)) {
        continue
      }

      const baseStart = setMinutes(setHours(day, session.startHour), 0)
      const available = findAvailableSlot(baseStart, session.durationMinutes / 60, busySlots)

      tasks.push({
        id: crypto.randomUUID(),
        title: `第 ${weekIndex + 1} 周 · ${session.title}`,
        startTime: formatISO(available.start),
        endTime: formatISO(addMinutes(available.start, session.durationMinutes)),
        description: session.description,
      })
    }
  }

  return tasks
}

type ExpandPhaseTemplateParams = {
  startDate: string
  endDate: string
  phases: PhaseTemplatePhase[]
  busySlots?: BusySlot[]
  weekStartsOn?: 0 | 1
}

export function expandPhaseTemplateToTasks({
  startDate,
  endDate,
  phases,
  busySlots = [],
  weekStartsOn = 1,
}: ExpandPhaseTemplateParams): ProposedTask[] {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const weekAnchor = startOfWeek(start, { weekStartsOn })
  const tasks: ProposedTask[] = []

  const sortedPhases = [...phases].sort((left, right) => left.weekStart - right.weekStart)

  for (const phase of sortedPhases) {
    const phaseLength = Math.max(1, phase.weekEnd - phase.weekStart + 1)
    const phaseTasks = [...phase.tasks].sort((left, right) => {
      if (left.weekOffset === right.weekOffset) {
        if (left.dayOffset === right.dayOffset) {
          return left.startHour - right.startHour
        }

        return left.dayOffset - right.dayOffset
      }

      return left.weekOffset - right.weekOffset
    })

    for (const task of phaseTasks) {
      const boundedWeekOffset = Math.min(Math.max(task.weekOffset, 0), phaseLength - 1)
      const weekIndex = phase.weekStart - 1 + boundedWeekOffset
      const baseWeekStart = addDays(weekAnchor, weekIndex * 7)
      const day = addDays(baseWeekStart, task.dayOffset)

      if (isBefore(day, start) || isAfter(day, end)) {
        continue
      }

      const seedStart = setMinutes(setHours(day, task.startHour), 0)
      const available = findAvailableSlot(seedStart, task.durationMinutes / 60, busySlots)

      tasks.push({
        id: crypto.randomUUID(),
        title: `第 ${weekIndex + 1} 周 · ${task.title}`,
        startTime: formatISO(available.start),
        endTime: formatISO(addMinutes(available.start, task.durationMinutes)),
        description: task.description,
      })
    }
  }

  return tasks.sort((left, right) => left.startTime.localeCompare(right.startTime))
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

function buildStudyFallbackTasks(params: DefaultTaskParams): ProposedTask[] {
  const { goal, startDate, endDate, busySlots = [], sessionsPerWeek } = params

  if (/(论文|初稿|开题|文献|研究)/.test(goal)) {
    return expandPhaseTemplateToTasks({
      startDate,
      endDate,
      busySlots,
      phases: [
        {
          title: '资料与结构搭建',
          weekStart: 1,
          weekEnd: 2,
          tasks: [
            { title: '文献分组与笔记框架', description: '梳理核心文献并建立可复用的笔记目录。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 120 },
            { title: '论文结构与论点确认', description: '明确章节结构、核心论点和证据来源。', weekOffset: 1, dayOffset: 3, startHour: 19, durationMinutes: 120 },
          ],
        },
        {
          title: '研究与案例补强',
          weekStart: 3,
          weekEnd: 5,
          tasks: [
            { title: '方法与案例补证', description: '补足研究方法、样本或案例材料，避免后文无据可依。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 120 },
            { title: '章节草稿推进', description: '完成一个章节或一个核心小节的成稿推进。', weekOffset: 1, dayOffset: 3, startHour: 19, durationMinutes: 150 },
            { title: '引用与逻辑检查', description: '统一核对引用、图表和逻辑衔接，减少返工。', weekOffset: 2, dayOffset: 5, startHour: 10, durationMinutes: 120 },
          ],
        },
        {
          title: '初稿收束',
          weekStart: 6,
          weekEnd: 12,
          tasks: [
            { title: '整合全文初稿', description: '把分散内容并成连续初稿，优先保证完整性。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 180 },
            { title: '导师问题清单与修订', description: '整理待确认问题并完成一轮集中修订。', weekOffset: 1, dayOffset: 4, startHour: 19, durationMinutes: 120 },
          ],
        },
      ],
    })
  }

  const effectiveSessions = Math.max(3, Math.min(5, sessionsPerWeek ?? 4))
  const library = /(雅思|托福|考试|备考|刷题|口语|阅读|听力|写作)/.test(goal) ? STUDY_EXAM_SESSIONS : STUDY_GENERIC_SESSIONS

  return expandRecurringTemplateToTasks({
    startDate,
    endDate,
    busySlots,
    sessions: library.slice(0, effectiveSessions),
  })
}

function buildCareerFallbackTasks(params: DefaultTaskParams): ProposedTask[] {
  const { goal, startDate, endDate, busySlots = [], sessionsPerWeek } = params
  const sessions = [...CAREER_SESSIONS]

  if (/(数据分析|Python|SQL|Excel)/i.test(goal)) {
    sessions[0] = { ...sessions[0], title: '数据分析技能补课', description: '围绕 SQL、Python 或统计基础补足当前最短板。' }
    sessions[1] = { ...sessions[1], title: '分析项目实战', description: '推进一个能展示分析思路与结果表达的项目案例。' }
  }

  if (/(面试)/.test(goal)) {
    sessions[3] = { ...sessions[3], title: '面试模拟与复盘', description: '整理高频问题、做一次模拟表达并更新答题框架。' }
  }

  return expandRecurringTemplateToTasks({
    startDate,
    endDate,
    busySlots,
    sessions: sessions.slice(0, Math.max(3, Math.min(4, sessionsPerWeek ?? 4))),
  })
}

function buildContentFallbackTasks(params: DefaultTaskParams): ProposedTask[] {
  const { startDate, endDate, busySlots = [], sessionsPerWeek, goal } = params
  const sessions = [...CONTENT_SESSIONS]

  if (/(咨询|转化|成交)/.test(goal)) {
    sessions[3] = { ...sessions[3], title: '数据复盘与线索跟进', description: '复盘咨询线索和数据表现，筛出更容易转化的内容方向。' }
  }

  return expandRecurringTemplateToTasks({
    startDate,
    endDate,
    busySlots,
    sessions: sessions.slice(0, Math.max(3, Math.min(4, sessionsPerWeek ?? 4))),
  })
}

function buildErrandFallbackTasks(params: DefaultTaskParams): ProposedTask[] {
  const { goal, startDate, endDate, busySlots = [], sessionsPerWeek } = params

  if (/(买菜|备餐|晚饭|高蛋白|超市|菜市场)/.test(goal)) {
    return expandRecurringTemplateToTasks({
      startDate,
      endDate,
      busySlots,
      sessions: GROCERY_SESSIONS.slice(0, Math.max(3, Math.min(4, sessionsPerWeek ?? 4))),
    })
  }

  if (/(清洁|整理|收纳|衣柜|厨房|书桌)/.test(goal)) {
    return expandRecurringTemplateToTasks({
      startDate,
      endDate,
      busySlots,
      sessions: HOUSEHOLD_SESSIONS.slice(0, Math.max(3, Math.min(3, sessionsPerWeek ?? 3))),
    })
  }

  if (/(搬家|打包|搬运|新公寓|老小区)/.test(goal)) {
    return expandPhaseTemplateToTasks({
      startDate,
      endDate,
      busySlots,
      phases: [
        {
          title: '盘点与清理',
          weekStart: 1,
          weekEnd: 1,
          tasks: [
            { title: '物品分区盘点', description: '按房间列出必须带走、可转卖和可丢弃物品。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 120 },
            { title: '杂物清理与耗材准备', description: '集中处理低价值杂物，并备好纸箱、胶带和标签。', weekOffset: 0, dayOffset: 4, startHour: 19, durationMinutes: 120 },
          ],
        },
        {
          title: '分类打包',
          weekStart: 2,
          weekEnd: 2,
          tasks: [
            { title: '非高频物品先打包', description: '优先封箱低频使用物品，减少临搬家日前的混乱。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 150 },
            { title: '高频生活区收尾', description: '给厨房、衣物和洗漱用品保留最后一周可用量。', weekOffset: 0, dayOffset: 5, startHour: 10, durationMinutes: 150 },
          ],
        },
        {
          title: '搬入与安置',
          weekStart: 3,
          weekEnd: 3,
          tasks: [
            { title: '搬家日执行', description: '按清单完成装车、交接、到新住处卸货和基础检查。', weekOffset: 0, dayOffset: 5, startHour: 9, durationMinutes: 240 },
            { title: '新居基础安置', description: '优先恢复卧室、洗漱区和厨房等高频生活功能。', weekOffset: 0, dayOffset: 6, startHour: 14, durationMinutes: 180 },
          ],
        },
      ],
    })
  }

  if (/(旅行|出发|签证|机票|住宿|酒店|交通|自由行)/.test(goal)) {
    return expandPhaseTemplateToTasks({
      startDate,
      endDate,
      busySlots,
      phases: [
        {
          title: '证件与预算确认',
          weekStart: 1,
          weekEnd: 2,
          tasks: [
            { title: '签证与证件准备', description: '整理签证材料、证件有效期和必须完成的前置手续。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 90 },
            { title: '预算框架确认', description: '按机票、住宿、交通和日常消费拆出可接受预算。', weekOffset: 1, dayOffset: 3, startHour: 19, durationMinutes: 60 },
          ],
        },
        {
          title: '机酒与交通锁定',
          weekStart: 3,
          weekEnd: 4,
          tasks: [
            { title: '机票与住宿预订', description: '完成主要机酒预订并确认退改规则。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 90 },
            { title: '城市内交通规划', description: '确定交通卡、跨城移动和高频路线的最省心方案。', weekOffset: 1, dayOffset: 4, startHour: 19, durationMinutes: 75 },
          ],
        },
        {
          title: '行前确认',
          weekStart: 5,
          weekEnd: 6,
          tasks: [
            { title: '行程单与预约整理', description: '统一整理订单、地址、预约信息和备选方案。', weekOffset: 0, dayOffset: 2, startHour: 19, durationMinutes: 75 },
            { title: '打包与出发检查', description: '按天气与路线完成打包，并做一轮出发前确认。', weekOffset: 1, dayOffset: 5, startHour: 19, durationMinutes: 90 },
          ],
        },
      ],
    })
  }

  return expandRecurringTemplateToTasks({
    startDate,
    endDate,
    busySlots,
    sessions: GROCERY_SESSIONS.slice(0, Math.max(2, Math.min(3, sessionsPerWeek ?? 3))),
  })
}

function buildProjectFallbackTasks(params: DefaultTaskParams): ProposedTask[] {
  const { goal, startDate, endDate, busySlots = [] } = params

  if (/(作品集|UX|网站|上线)/.test(goal)) {
    return expandPhaseTemplateToTasks({
      startDate,
      endDate,
      busySlots,
      phases: [
        {
          title: '范围和内容确定',
          weekStart: 1,
          weekEnd: 2,
          tasks: [
            { title: '站点结构与案例清单', description: '确定页面结构、导航和要展示的核心案例。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 120 },
            { title: '视觉方向与文案骨架', description: '完成首页、关于我和联系页的文案与视觉方向。', weekOffset: 1, dayOffset: 3, startHour: 19, durationMinutes: 120 },
          ],
        },
        {
          title: '核心实现',
          weekStart: 3,
          weekEnd: 5,
          tasks: [
            { title: '案例页与组件开发', description: '优先完成最关键的案例展示和通用组件。', weekOffset: 0, dayOffset: 1, startHour: 19, durationMinutes: 150 },
            { title: '联系与埋点接入', description: '补齐表单、埋点和基础交互，确保能被验证。', weekOffset: 2, dayOffset: 4, startHour: 19, durationMinutes: 120 },
          ],
        },
        {
          title: '测试与上线',
          weekStart: 6,
          weekEnd: 8,
          tasks: [
            { title: '多端检查与问题修正', description: '集中修复视觉、性能和交互问题。', weekOffset: 0, dayOffset: 2, startHour: 19, durationMinutes: 120 },
            { title: '上线与投递准备', description: '完成部署、域名检查并整理投递时要用的链接与说明。', weekOffset: 2, dayOffset: 5, startHour: 10, durationMinutes: 120 },
          ],
        },
      ],
    })
  }

  return expandPhaseTemplateToTasks({
    startDate,
    endDate,
    busySlots,
    phases: [
      {
        title: '目标与范围',
        weekStart: 1,
        weekEnd: 2,
        tasks: [
          { title: '范围确认', description: '明确成功标准、关键里程碑和必须先做的部分。', weekOffset: 0, dayOffset: 1, startHour: 10, durationMinutes: 120 },
          { title: '执行拆解', description: '把目标拆成可推进的模块和验收节点。', weekOffset: 1, dayOffset: 3, startHour: 14, durationMinutes: 120 },
        ],
      },
      {
        title: '主体推进',
        weekStart: 3,
        weekEnd: 5,
        tasks: [
          { title: '核心推进块', description: '推进最影响结果的核心部分，并及时暴露阻塞项。', weekOffset: 0, dayOffset: 1, startHour: 14, durationMinutes: 150 },
          { title: '中段校准', description: '检查偏差、修正优先级，防止后半程失控。', weekOffset: 2, dayOffset: 4, startHour: 10, durationMinutes: 120 },
        ],
      },
      {
        title: '收尾与交付',
        weekStart: 6,
        weekEnd: 8,
        tasks: [
          { title: '交付整理', description: '补齐文档、边界问题和必要的演示物料。', weekOffset: 0, dayOffset: 2, startHour: 14, durationMinutes: 120 },
          { title: '复盘与发布', description: '做一轮最终检查、发布和复盘，形成可复用经验。', weekOffset: 2, dayOffset: 5, startHour: 10, durationMinutes: 120 },
        ],
      },
    ],
  })
}

function buildGeneralFallbackTasks(params: DefaultTaskParams): ProposedTask[] {
  const { goal, startDate, endDate, busySlots = [], sessionsPerWeek } = params

  if (/(作息|睡眠|晚睡|早起|晨间|晚间|效率差|运动)/.test(goal)) {
    return expandRecurringTemplateToTasks({
      startDate,
      endDate,
      busySlots,
      sessions: ROUTINE_SESSIONS.slice(0, Math.max(3, Math.min(3, sessionsPerWeek ?? 3))),
    })
  }

  return expandPhaseTemplateToTasks({
    startDate,
    endDate,
    busySlots,
    phases: [
      {
        title: '起步与拆解',
        weekStart: 1,
        weekEnd: 2,
        tasks: [
          { title: '目标拆解与限制确认', description: `围绕「${goal}」明确结果、限制和最关键的优先级。`, weekOffset: 0, dayOffset: 1, startHour: 10, durationMinutes: 120 },
          { title: '第一轮执行块', description: '先完成最容易产生成果感的一步，建立推进节奏。', weekOffset: 1, dayOffset: 3, startHour: 14, durationMinutes: 120 },
        ],
      },
      {
        title: '主体推进',
        weekStart: 3,
        weekEnd: 5,
        tasks: [
          { title: '核心执行块', description: '把时间投入到真正改变结果的动作，不做空转准备。', weekOffset: 0, dayOffset: 1, startHour: 14, durationMinutes: 120 },
          { title: '周中校准', description: '检查进度和障碍，立刻缩减无效动作。', weekOffset: 1, dayOffset: 4, startHour: 19, durationMinutes: 90 },
        ],
      },
      {
        title: '收束与复盘',
        weekStart: 6,
        weekEnd: 8,
        tasks: [
          { title: '结果整理', description: '把当前产出整理成可回顾、可延续的版本。', weekOffset: 0, dayOffset: 2, startHour: 19, durationMinutes: 90 },
          { title: '复盘与下一轮计划', description: '总结有效做法和剩余问题，给下一阶段留下明确入口。', weekOffset: 1, dayOffset: 5, startHour: 15, durationMinutes: 90 },
        ],
      },
    ],
  })
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

  if (domain === 'study') {
    return buildStudyFallbackTasks({ goal, startDate, endDate, weeklyHours, busySlots, sessionsPerWeek, domain })
  }

  if (domain === 'career') {
    return buildCareerFallbackTasks({ goal, startDate, endDate, weeklyHours, busySlots, sessionsPerWeek, domain })
  }

  if (domain === 'content') {
    return buildContentFallbackTasks({ goal, startDate, endDate, weeklyHours, busySlots, sessionsPerWeek, domain })
  }

  if (domain === 'errand') {
    return buildErrandFallbackTasks({ goal, startDate, endDate, weeklyHours, busySlots, sessionsPerWeek, domain })
  }

  if (domain === 'project') {
    return buildProjectFallbackTasks({ goal, startDate, endDate, weeklyHours, busySlots, sessionsPerWeek, domain })
  }

  return buildGeneralFallbackTasks({ goal, startDate, endDate, weeklyHours, busySlots, sessionsPerWeek, domain })
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
