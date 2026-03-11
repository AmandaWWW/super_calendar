import { NextResponse } from 'next/server'
import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, isAfter, parseISO } from 'date-fns'
import type { CalendarEvent, ChatMessage, PlannerApiResponse, ProposedTask } from '@/lib/calendar-types'
import {
  buildDefaultTasks,
  expandPhaseTemplateToTasks,
  expandRecurringTemplateToTasks,
  type PhaseTemplatePhase,
  type PlanDomain,
  type RecurringTemplateSession,
} from '@/lib/task-planning'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = ['hkg1', 'sin1']

const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const DEFAULT_MODEL_TIMEOUT_MS = 55_000
const parsedTimeoutMs = Number(process.env.PLANNER_MODEL_TIMEOUT_MS ?? DEFAULT_MODEL_TIMEOUT_MS)
const MODEL_TIMEOUT_MS = Number.isFinite(parsedTimeoutMs)
  ? Math.min(Math.max(parsedTimeoutMs, 5_000), 110_000)
  : DEFAULT_MODEL_TIMEOUT_MS

const COMPACT_TEMPLATE_TIMEOUT_MS = 18_000
const COMPACT_PHASE_TIMEOUT_MS = 20_000
const DIRECT_PLAN_TIMEOUT_MS = 40_000

type PlannerRequestBody = {
  userInput?: string
  plannerForm?: {
    goal?: string
    startDate?: string
    endDate?: string
    weeklyHours?: number
  }
  chatHistory?: ChatMessage[]
  goalTurns?: number
  forceGenerate?: boolean
  busySlots?: CalendarEvent[]
}

type PlanningContext = {
  domain: PlanDomain
  sessionsPerWeek: number | null
  estimatedSessionsPerWeek: number | null
  hasRecurringCadence: boolean
  durationDays: number
  durationWeeks: number
  requiredTaskCount: number | null
  hasInjuryConstraint: boolean
  avoidAdministrativeTasks: boolean
  allowsProcurementTasks: boolean
  effectivePlannerForm: {
    goal: string
    startDate: string
    endDate: string
    weeklyHours: number
  }
}

type PlannerCallOptions = {
  maxTokens?: number
  timeoutMs?: number
}

function extractJsonArray(text: string) {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('[')
    const end = text.lastIndexOf(']')

    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }

    return null
  }
}

function extractJsonObject(text: string) {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')

    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }

    return null
  }
}

function isChatter(input: string) {
  const value = input.trim().toLowerCase()
  return /^(hi|hello|hey|你好|您好|在吗|早上好|晚上好|中午好)/.test(value) || /天气|吃饭|睡觉|哈哈|表情包/.test(value)
}

function parseLooseNumber(raw: string) {
  const normalized = raw.trim()
  if (/^\d+$/.test(normalized)) return Number(normalized)

  const simpleMap: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
    十一: 11,
    十二: 12,
  }

  if (simpleMap[normalized] !== undefined) {
    return simpleMap[normalized]
  }

  if (normalized.startsWith('十')) {
    return 10 + (simpleMap[normalized.slice(1)] ?? 0)
  }

  return null
}

function inferRequestedEndDate(userInput: string, startDate: string, fallbackEndDate: string) {
  const start = parseISO(startDate)
  let inferredEnd = parseISO(fallbackEndDate)
  const patterns = [
    { regex: /([一二三四五六七八九十两\d]+)\s*(?:个)?月/g, unit: 'month' as const },
    { regex: /([一二三四五六七八九十两\d]+)\s*周/g, unit: 'week' as const },
    { regex: /([一二三四五六七八九十两\d]+)\s*天/g, unit: 'day' as const },
  ]

  for (const pattern of patterns) {
    for (const match of userInput.matchAll(pattern.regex)) {
      const value = parseLooseNumber(match[1])
      if (!value || value <= 0) continue

      const candidate =
        pattern.unit === 'month'
          ? addDays(addMonths(start, value), -1)
          : pattern.unit === 'week'
            ? addDays(addWeeks(start, value), -1)
            : addDays(start, value - 1)

      if (isAfter(candidate, inferredEnd)) {
        inferredEnd = candidate
      }
    }
  }

  return format(inferredEnd, 'yyyy-MM-dd')
}

function inferSessionsPerWeek(userInput: string) {
  const explicitWeeklyMatch = userInput.match(/每周\s*([一二三四五六七八九十两\d]+)\s*(?:次|练|天|节|训|条|篇|餐|顿|块|场|组)?/)
  if (explicitWeeklyMatch) {
    return parseLooseNumber(explicitWeeklyMatch[1])
  }

  const splitMatch = userInput.match(/([一二三四五六七八九十两\d]+)\s*分化/)
  if (splitMatch) {
    return parseLooseNumber(splitMatch[1])
  }

  if (/每天|每日|每晚|每早/.test(userInput)) {
    return 7
  }

  if (/工作日/.test(userInput) && /周末/.test(userInput)) {
    return 6
  }

  if (/工作日/.test(userInput)) {
    return 5
  }

  return null
}

function inferDomain(input: string, chatHistory: ChatMessage[]): PlanDomain {
  const combined = [input, ...chatHistory.map((item) => item.content)].join(' ')

  if (/(减脂|减重|体脂|塑形|增肌|训练|健身|有氧|力量|跑步|分化|体重|身高|kg|公斤|髋关节|损伤|疼痛|康复|恢复|卧推|深蹲|臀|肩|胸|背)/i.test(combined)) {
    return 'fitness'
  }

  if (/(学习|复习|备考|考试|课程|刷题|单词|背诵|论文|训练营|读书|看书|研究课题|雅思|托福|考研|考公)/i.test(combined)) {
    return 'study'
  }

  if (/(小红书|公众号|视频号|内容规划|选题|涨粉|脚本|拍摄|剪辑|发帖|内容日历|转化)/i.test(combined)) {
    return 'content'
  }

  if (/(买菜|购物|采购|采买|囤货|超市|菜市场|备餐|做饭|跑腿|收纳|家务|清洁|搬家|签证|住宿|机票|酒店|自由行|交通)/i.test(combined)) {
    return 'errand'
  }

  if (/(上线|开发|产品|项目|交付|原型|设计|测试|发布|实现|迭代|版本|PRD|需求|代码|网站|前端|后端|页面|表单|埋点)/i.test(combined)) {
    return 'project'
  }

  if (/(求职|转行|简历|作品集|投递|面试|内推|岗位|找工作|职业)/i.test(combined)) {
    return 'career'
  }

  return 'general'
}

function inferDefaultRecurringSessions(domain: PlanDomain, userInput: string) {
  if (/(每天|每日)/.test(userInput)) return 5
  if (/工作日/.test(userInput) && /周末/.test(userInput)) return 4

  switch (domain) {
    case 'fitness':
      return 4
    case 'study':
      return 4
    case 'career':
      return 4
    case 'content':
      return 4
    case 'errand':
      return /(买菜|备餐|清洁|整理)/.test(userInput) ? 3 : 2
    default:
      return 3
  }
}

function inferRecurringCadence(userInput: string, domain: PlanDomain) {
  if (/每周|每天|每日|工作日|周末|每晚|每早|晨间|晚间|日常|作息|持续|连续|固定安排/.test(userInput)) {
    return true
  }

  if (domain === 'fitness' || domain === 'content') {
    return true
  }

  return /(买菜|备餐|清洁|整理|复习计划|学习计划|内容规划|训练计划)/.test(userInput)
}

function needsClarification(input: string, chatHistory: ChatMessage[]) {
  const combined = [input, ...chatHistory.map((item) => item.content)].join(' ')
  const compactLength = combined.replace(/\s+/g, '').length
  const hasConcreteGoal = /(完成|上线|交付|掌握|学会|开发|做出|搭建|写完|通过|复习|设计|发布|减脂|减重|塑形|增肌|训练|备赛|康复|求职|投递|搬家|出发|备餐|整理)/.test(
    combined,
  )
  const hasPlanningConstraint = /(天|周|月|次|分化|小时|分钟|kg|公斤|身高|体重|损伤|疼痛|时间段|频率|节奏|预算)/i.test(combined)
  const tooBroad = /(提升自己|搞懂技术|学编程|做项目|学习一下|试试看|安排一下|想健身|想锻炼|帮我规划一下)/i.test(combined)

  return compactLength < 10 || (!hasConcreteGoal && !hasPlanningConstraint) || tooBroad
}

function buildClarifyingQuestion(turns: number) {
  if (turns === 1) {
    return '我已经知道你的大方向了，但还缺少能真正排进日历的约束。请补充以下任意一项：持续多久、每周几次/每次多久、必须避开的限制（如伤病或时间段）、或者你最想达成的结果。'
  }

  return '再补一条最关键的信息：你每周大概能投入几次、每次多久，或者哪些动作/时间段必须避开；如果你不再补充，我会按当前信息直接生成一版保守可执行计划。'
}

function buildPlanningContext(userInput: string, plannerForm: NonNullable<PlannerRequestBody['plannerForm']>, chatHistory: ChatMessage[]) {
  const domain = inferDomain(userInput, chatHistory)
  const sessionsPerWeek = inferSessionsPerWeek(userInput)
  const hasRecurringCadence = inferRecurringCadence(userInput, domain)
  const estimatedSessionsPerWeek = sessionsPerWeek ?? (hasRecurringCadence ? inferDefaultRecurringSessions(domain, userInput) : null)
  const effectiveEndDate = inferRequestedEndDate(userInput, plannerForm.startDate ?? '', plannerForm.endDate ?? '')
  const durationDays = Math.max(1, differenceInCalendarDays(parseISO(effectiveEndDate), parseISO(plannerForm.startDate ?? '')) + 1)
  const durationWeeks = Math.max(1, Math.ceil(durationDays / 7))
  const requiredTaskCount = estimatedSessionsPerWeek && durationWeeks > 1 ? Math.min(durationWeeks * estimatedSessionsPerWeek, 72) : null
  const allowsProcurementTasks = domain === 'errand' || /(购买|买菜|购物|采购|采买|囤货|超市|菜市场|装备|器材|机票|住宿|酒店)/i.test(userInput)

  return {
    domain,
    sessionsPerWeek,
    estimatedSessionsPerWeek,
    hasRecurringCadence,
    durationDays,
    durationWeeks,
    requiredTaskCount,
    hasInjuryConstraint: /(损伤|受伤|疼痛|术后|康复|髋关节|膝|腰|肩|不适)/i.test(userInput),
    avoidAdministrativeTasks: true,
    allowsProcurementTasks,
    effectivePlannerForm: {
      goal: plannerForm.goal ?? '',
      startDate: plannerForm.startDate ?? '',
      endDate: effectiveEndDate,
      weeklyHours: plannerForm.weeklyHours ?? 12,
    },
  } satisfies PlanningContext
}

function shouldFilterAdministrativeTask(task: ProposedTask, context: PlanningContext) {
  if (!context.avoidAdministrativeTasks) return false

  const combined = `${task.title} ${task.description}`

  if (!context.allowsProcurementTasks && /(购买|装备|器材|蛋白粉|补剂|护具|鞋|服装|app下载|下载app|下载应用|下载软件|购物|采购|采买)/i.test(combined)) {
    return true
  }

  if (context.domain === 'fitness' || context.domain === 'study' || context.domain === 'career') {
    if (/(制定计划|计划制定|搜集资料|研究动作|看视频教程|准备器材|下载资料|买书|购买课程)/i.test(combined)) {
      return true
    }
  }

  return false
}

function normalizeTasks(tasks: unknown, context: PlanningContext): ProposedTask[] {
  if (!Array.isArray(tasks)) return []

  return tasks
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
      title: typeof item.title === 'string' ? item.title : '未命名任务',
      startTime: typeof item.startTime === 'string' ? item.startTime : '',
      endTime: typeof item.endTime === 'string' ? item.endTime : '',
      description: typeof item.description === 'string' ? item.description : '',
    }))
    .filter((item) => item.startTime && item.endTime)
    .filter((item) => !shouldFilterAdministrativeTask(item, context))
    .sort((left, right) => left.startTime.localeCompare(right.startTime))
}

function normalizeRecurringTemplate(template: unknown, context: PlanningContext) {
  if (typeof template !== 'object' || template === null) return []

  const sessions = Array.isArray((template as { sessions?: unknown[] }).sessions) ? (template as { sessions: unknown[] }).sessions : []
  const maxSessions = context.estimatedSessionsPerWeek ? Math.max(1, Math.min(context.estimatedSessionsPerWeek, 7)) : 6

  return sessions
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      title: typeof item.title === 'string' ? item.title.trim() : '',
      description: typeof item.description === 'string' ? item.description.trim() : '',
      dayOffset: typeof item.dayOffset === 'number' ? Math.min(Math.max(Math.round(item.dayOffset), 0), 6) : 0,
      startHour: typeof item.startHour === 'number' ? Math.min(Math.max(Math.round(item.startHour), 6), 21) : 18,
      durationMinutes:
        typeof item.durationMinutes === 'number'
          ? Math.min(Math.max(Math.round(item.durationMinutes), 30), 180)
          : 60,
    }))
    .filter((item) => item.title && item.description)
    .slice(0, maxSessions)
}

function normalizePhaseTemplate(template: unknown): PhaseTemplatePhase[] {
  if (typeof template !== 'object' || template === null) return []

  const phases = Array.isArray((template as { phases?: unknown[] }).phases) ? (template as { phases: unknown[] }).phases : []

  return phases
    .filter((phase): phase is Record<string, unknown> => typeof phase === 'object' && phase !== null)
    .map((phase) => ({
      title: typeof phase.title === 'string' ? phase.title.trim() : '',
      weekStart: typeof phase.weekStart === 'number' ? Math.max(1, Math.round(phase.weekStart)) : 1,
      weekEnd: typeof phase.weekEnd === 'number' ? Math.max(1, Math.round(phase.weekEnd)) : 1,
      tasks: Array.isArray(phase.tasks)
        ? phase.tasks
            .filter((task): task is Record<string, unknown> => typeof task === 'object' && task !== null)
            .map((task) => ({
              title: typeof task.title === 'string' ? task.title.trim() : '',
              description: typeof task.description === 'string' ? task.description.trim() : '',
              weekOffset: typeof task.weekOffset === 'number' ? Math.max(0, Math.round(task.weekOffset)) : 0,
              dayOffset: typeof task.dayOffset === 'number' ? Math.min(Math.max(Math.round(task.dayOffset), 0), 6) : 0,
              startHour: typeof task.startHour === 'number' ? Math.min(Math.max(Math.round(task.startHour), 6), 21) : 18,
              durationMinutes:
                typeof task.durationMinutes === 'number'
                  ? Math.min(Math.max(Math.round(task.durationMinutes), 30), 180)
                  : 60,
            }))
            .filter((task) => task.title && task.description)
        : [],
    }))
    .filter((phase) => phase.title && phase.tasks.length)
}

function planHasEnoughCoverage(tasks: ProposedTask[], context: PlanningContext) {
  if (!tasks.length) return false

  const lastTaskDate = tasks
    .map((task) => parseISO(task.endTime))
    .sort((left, right) => left.getTime() - right.getTime())
    .at(-1)

  if (!lastTaskDate) return false

  const daysToEnd = differenceInCalendarDays(parseISO(context.effectivePlannerForm.endDate), lastTaskDate)
  const spansWindow = context.durationWeeks < 4 ? daysToEnd <= 10 : daysToEnd <= 14

  if (context.requiredTaskCount) {
    return tasks.length >= Math.max(6, Math.floor(context.requiredTaskCount * 0.75)) && spansWindow
  }

  if (context.hasRecurringCadence) {
    return tasks.length >= Math.max(6, Math.min(context.durationWeeks * 2, 12)) && spansWindow
  }

  if (context.durationWeeks >= 6) {
    return tasks.length >= 6 && spansWindow
  }

  return true
}

function shouldUseRecurringTemplateMode(context: PlanningContext) {
  return Boolean(context.durationWeeks >= 4 && context.hasRecurringCadence && context.domain !== 'project')
}

function shouldUsePhaseTemplateMode(context: PlanningContext) {
  return Boolean(context.durationWeeks >= 4 && !shouldUseRecurringTemplateMode(context))
}

function buildSystemPrompt(context: PlanningContext) {
  const rules = [
    '你是 Vibe Calendar 的高级排期助手。',
    '你的职责是把用户目标转成可以直接放进日历的可执行任务数组。',
    '你只能输出严格 JSON 数组，不要 markdown，不要解释文字，不要代码块。',
    '输出 schema：[{ "id":"uuid", "title":"任务名", "startTime":"ISO格式", "endTime":"ISO格式", "description":"细节" }]',
    'title 要短而明确；description 只写 1 句执行说明，尽量控制在 40 个汉字以内。',
    '每个元素都必须是用户真正要执行的日程块，而不是泛泛建议。',
    '除非用户明确要求，否则不要输出购买装备、下载 app、准备物资、搜集资料、制定计划这类非核心执行事项。',
    '必须覆盖 effectivePlannerForm.startDate 到 effectivePlannerForm.endDate 的整个周期，而不是只覆盖前几天。',
    '必须严格避开 busySlots，并默认预留 12:00-13:30 午餐和 23:00-08:00 睡眠时段。',
  ]

  if (context.domain === 'fitness') {
    rules.push('当前是训练目标。任务应该是真正的训练、恢复或阶段复盘 session，不要输出行政事项。')
  } else if (context.domain === 'study') {
    rules.push('当前是学习目标。任务应是可执行的学习块、练习块、复盘块、模拟块。')
  } else if (context.domain === 'career') {
    rules.push('当前是求职/转岗目标。任务应是技能补课、项目实战、简历作品集、投递或面试复盘。')
  } else if (context.domain === 'content') {
    rules.push('当前是内容规划目标。任务应是选题、脚本、制作、发布、复盘或转化跟进。')
  } else if (context.domain === 'errand') {
    rules.push('当前是跑腿/采购/日常事务目标。采购、备餐、清洁、整理、预订和打包都可以是有效执行项。')
  } else if (context.domain === 'project') {
    rules.push('当前是项目/交付目标。需求分析、实现、测试、联调、发布都可以是有效执行项。')
  }

  return rules.join('\n')
}

function buildRecurringTemplatePrompt(context: PlanningContext) {
  const lines = [
    '你是 Vibe Calendar 的周模板助手。',
    '不要直接输出完整日历任务数组。',
    '只输出严格 JSON 对象，不要 markdown，不要解释。',
    'schema：{ "mode":"recurring-template", "sessions":[{ "title":"string", "description":"string", "dayOffset":0-6, "startHour":6-21, "durationMinutes":30-180 }] }',
    'sessions 表示一个标准周内要重复执行的核心动作模板，服务端会展开到整个周期。',
    'title 简短明确，description 只写一句执行说明。',
  ]

  if (context.estimatedSessionsPerWeek) {
    lines.push(`必须输出 ${context.estimatedSessionsPerWeek} 个 sessions，代表用户每周要执行的 ${context.estimatedSessionsPerWeek} 次核心动作。`)
  } else {
    lines.push('根据用户节奏输出 2 到 5 个 sessions，不要过少。')
  }

  if (context.domain === 'fitness') {
    lines.push('训练目标：输出每周重复的训练课表模板，不要行政事项。')
  } else if (context.domain === 'study') {
    lines.push('学习目标：输出每周重复的学习块、练习块、复盘块、模拟块。')
  } else if (context.domain === 'career') {
    lines.push('求职目标：输出每周重复的技能补课、项目实战、简历作品集、投递或面试复盘。')
  } else if (context.domain === 'content') {
    lines.push('内容目标：输出每周重复的选题、制作、发布、复盘或转化跟进动作。')
  } else if (context.domain === 'errand') {
    lines.push('日常事务目标：输出每周重复的采购、备餐、清洁、整理或补货动作。')
  } else {
    lines.push('输出每周重复执行的核心动作模板。')
  }

  return lines.join('\n')
}

function buildPhaseTemplatePrompt() {
  return [
    '你是 Vibe Calendar 的阶段蓝图助手。',
    '不要直接输出完整日历任务数组。',
    '只输出严格 JSON 对象，不要 markdown，不要解释。',
    'schema：{ "mode":"phase-template", "phases":[{ "title":"string", "weekStart":1, "weekEnd":2, "tasks":[{ "title":"string", "description":"string", "weekOffset":0, "dayOffset":0-6, "startHour":6-21, "durationMinutes":30-180 }] }] }',
    'phases 表示分阶段的推进蓝图；每个 task 只需要出现一次，服务端会按周次落到日历。',
    '至少输出 3 个 phases；每个 phase 至少 2 个 tasks；任务要覆盖整个周期。',
    '任务必须是真正的执行项，不能是空泛建议或行政事项。',
  ].join('\n')
}

function summarizeBusySlots(busySlots: CalendarEvent[]) {
  return busySlots
    .filter((slot) => slot.start && slot.end)
    .slice(0, 12)
    .map((slot) => ({
      title: String(slot.title ?? '已有日程'),
      start: String(slot.start),
      end: String(slot.end),
    }))
}

function buildCompactPayload(
  userInput: string,
  context: PlanningContext,
  busySlots: CalendarEvent[],
  chatHistory: ChatMessage[],
) {
  const constraints = [
    `周期：${context.effectivePlannerForm.startDate} 到 ${context.effectivePlannerForm.endDate}`,
    `时长：约 ${context.durationWeeks} 周`,
    context.estimatedSessionsPerWeek ? `节奏：每周约 ${context.estimatedSessionsPerWeek} 次` : '节奏：按阶段推进',
    `每周可投入：约 ${context.effectivePlannerForm.weeklyHours} 小时`,
  ]

  if (context.hasInjuryConstraint) {
    constraints.push('存在伤病/疼痛限制，需要保守安排')
  }

  return {
    goal: userInput,
    domain: context.domain,
    constraints,
    recentContext: chatHistory.slice(-4).map((item) => `${item.role}:${item.content}`),
    busySlots: summarizeBusySlots(busySlots),
  }
}

async function callPlannerModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  payload: Record<string, unknown>,
  options: PlannerCallOptions = {},
) {
  const timeoutMs = options.timeoutMs ?? MODEL_TIMEOUT_MS
  const maxTokens = options.maxTokens ?? 5000

  return fetch(DASHSCOPE_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    }),
  })
}

function buildGeneratedResponse(message: string, goalTurns: number, tasks: ProposedTask[]): PlannerApiResponse {
  return {
    status: 'generated',
    message,
    nextAiStatus: 'generating',
    goalTurns,
    tasks,
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.BAILIAN_API_KEY
  const model = process.env.BAILIAN_MODEL || 'deepseek-v3.1'
  const body = (await request.json()) as PlannerRequestBody
  const { userInput, plannerForm, chatHistory = [], goalTurns = 0, forceGenerate = false, busySlots = [] } = body || {}

  const { goal, startDate, endDate, weeklyHours } = plannerForm || {}

  if (!userInput || !goal || !startDate || !endDate || !weeklyHours) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (isChatter(userInput)) {
    const response: PlannerApiResponse = {
      status: 'blocked',
      message: '本面板专注为您生成日程计划，请告诉我您的具体项目或学习目标。',
      nextAiStatus: 'idle',
      goalTurns,
    }

    return NextResponse.json(response)
  }

  const nextTurns = forceGenerate ? Math.max(goalTurns, 3) : goalTurns + 1
  const safePlannerForm = plannerForm as NonNullable<PlannerRequestBody['plannerForm']>
  const planningContext = buildPlanningContext(userInput, safePlannerForm, chatHistory)
  const normalizedBusySlots = (busySlots as CalendarEvent[]).map((slot) => ({
    start: String(slot.start),
    end: String(slot.end),
    title: String(slot.title ?? '已有日程'),
  }))

  if (!forceGenerate && goalTurns > 0 && nextTurns < 3 && needsClarification(userInput, chatHistory)) {
    return NextResponse.json({
      status: 'clarify',
      message: buildClarifyingQuestion(nextTurns),
      nextAiStatus: 'clarifying',
      goalTurns: nextTurns,
    } satisfies PlannerApiResponse)
  }

  const heuristicTasks = buildDefaultTasks({
    goal: planningContext.effectivePlannerForm.goal,
    startDate: planningContext.effectivePlannerForm.startDate,
    endDate: planningContext.effectivePlannerForm.endDate,
    weeklyHours: planningContext.effectivePlannerForm.weeklyHours,
    busySlots: normalizedBusySlots,
    domain: planningContext.domain,
    sessionsPerWeek: planningContext.estimatedSessionsPerWeek,
    hasInjuryConstraint: planningContext.hasInjuryConstraint,
  })

  if (!apiKey) {
    return NextResponse.json(
      buildGeneratedResponse('未配置大模型密钥，已基于当前上下文生成一份默认可执行计划。', nextTurns, heuristicTasks),
    )
  }

  const compactPayload = buildCompactPayload(userInput, planningContext, busySlots as CalendarEvent[], chatHistory)

  try {
    if (shouldUseRecurringTemplateMode(planningContext)) {
      const templateResponse = await callPlannerModel(apiKey, model, buildRecurringTemplatePrompt(planningContext), compactPayload, {
        maxTokens: 900,
        timeoutMs: COMPACT_TEMPLATE_TIMEOUT_MS,
      })

      if (templateResponse.ok) {
        const templateData = await templateResponse.json()
        const sessions = normalizeRecurringTemplate(extractJsonObject(templateData?.choices?.[0]?.message?.content || ''), planningContext)

        if (sessions.length >= Math.max(2, Math.min(planningContext.estimatedSessionsPerWeek ?? 3, 7))) {
          const tasks = expandRecurringTemplateToTasks({
            startDate: planningContext.effectivePlannerForm.startDate,
            endDate: planningContext.effectivePlannerForm.endDate,
            sessions: sessions as RecurringTemplateSession[],
            busySlots: normalizedBusySlots,
          })

          if (planHasEnoughCoverage(tasks, planningContext)) {
            return NextResponse.json(
              buildGeneratedResponse(
                forceGenerate
                  ? '已避开当前已知冲突时段重新生成任务草案，请确认后再应用到日历。'
                  : '已生成一组待确认任务，请先在任务看板审核再应用到日历。',
                nextTurns,
                tasks,
              ),
            )
          }
        }
      }

      return NextResponse.json(
        buildGeneratedResponse(
          forceGenerate
            ? '已按当前约束快速重排出一版可执行任务草案，请确认后再应用到日历。'
            : '已按你的目标与节奏生成一版可执行任务草案，请先审核再放进日历。',
          nextTurns,
          heuristicTasks,
        ),
      )
    }

    if (shouldUsePhaseTemplateMode(planningContext)) {
      const phaseResponse = await callPlannerModel(apiKey, model, buildPhaseTemplatePrompt(), compactPayload, {
        maxTokens: 1400,
        timeoutMs: COMPACT_PHASE_TIMEOUT_MS,
      })

      if (phaseResponse.ok) {
        const phaseData = await phaseResponse.json()
        const phases = normalizePhaseTemplate(extractJsonObject(phaseData?.choices?.[0]?.message?.content || ''))

        if (phases.length >= 3) {
          const tasks = expandPhaseTemplateToTasks({
            startDate: planningContext.effectivePlannerForm.startDate,
            endDate: planningContext.effectivePlannerForm.endDate,
            phases: phases as PhaseTemplatePhase[],
            busySlots: normalizedBusySlots,
          })

          if (planHasEnoughCoverage(tasks, planningContext)) {
            return NextResponse.json(
              buildGeneratedResponse(
                forceGenerate
                  ? '已避开当前已知冲突时段重新生成任务草案，请确认后再应用到日历。'
                  : '已生成一组待确认任务，请先在任务看板审核再应用到日历。',
                nextTurns,
                tasks,
              ),
            )
          }
        }
      }

      return NextResponse.json(
        buildGeneratedResponse(
          forceGenerate
            ? '已按当前约束快速重排出一版可执行任务草案，请确认后再应用到日历。'
            : '已按你的目标与约束生成一版可执行任务草案，请先审核再放进日历。',
          nextTurns,
          heuristicTasks,
        ),
      )
    }

    const systemPrompt = buildSystemPrompt(planningContext)
    const directPayload = {
      userInput,
      plannerForm: planningContext.effectivePlannerForm,
      planningContext,
      chatHistory,
      goalTurns: nextTurns,
      busySlots,
      mode: forceGenerate ? 'force-generate' : 'normal-generate',
    }

    const firstResponse = await callPlannerModel(apiKey, model, systemPrompt, directPayload, {
      maxTokens: 3200,
      timeoutMs: Math.min(MODEL_TIMEOUT_MS, DIRECT_PLAN_TIMEOUT_MS),
    })

    if (!firstResponse.ok) {
      return NextResponse.json(
        buildGeneratedResponse('已按当前约束生成一版可执行任务草案，请先审核再放进日历。', nextTurns, heuristicTasks),
      )
    }

    const firstData = await firstResponse.json()
    const firstTasks = normalizeTasks(extractJsonArray(firstData?.choices?.[0]?.message?.content || ''), planningContext)
    let tasks = firstTasks

    if (!planHasEnoughCoverage(tasks, planningContext) && planningContext.durationWeeks < 4) {
      const repairPrompt = `${systemPrompt}\n上一次输出覆盖不足。你必须补足整个周期，尤其是后半程，不要再只给前几天。`
      const repairResponse = await callPlannerModel(
        apiKey,
        model,
        repairPrompt,
        {
          ...directPayload,
          repairInstruction: {
            previousTaskCount: tasks.length,
            requiredTaskCount: planningContext.requiredTaskCount,
            requiredCoverageEndDate: planningContext.effectivePlannerForm.endDate,
          },
        },
        {
          maxTokens: 2600,
          timeoutMs: 15_000,
        },
      )

      if (repairResponse.ok) {
        const repairData = await repairResponse.json()
        const repairedTasks = normalizeTasks(extractJsonArray(repairData?.choices?.[0]?.message?.content || ''), planningContext)

        if (planHasEnoughCoverage(repairedTasks, planningContext)) {
          tasks = repairedTasks
        }
      }
    }

    if (!planHasEnoughCoverage(tasks, planningContext)) {
      return NextResponse.json(
        buildGeneratedResponse('已按当前约束生成一版可执行任务草案，请先审核再放进日历。', nextTurns, heuristicTasks),
      )
    }

    return NextResponse.json(
      buildGeneratedResponse(
        forceGenerate
          ? '已避开当前已知冲突时段重新生成任务草案，请确认后再应用到日历。'
          : '已生成一组待确认任务，请先在任务看板审核再应用到日历。',
        nextTurns,
        tasks,
      ),
    )
  } catch (error) {
    console.error('planner route fallback', {
      timeoutMs: MODEL_TIMEOUT_MS,
      domain: planningContext.domain,
      durationWeeks: planningContext.durationWeeks,
      sessionsPerWeek: planningContext.estimatedSessionsPerWeek,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
    })

    return NextResponse.json(
      buildGeneratedResponse('已按当前约束生成一版可执行任务草案，请先审核再放进日历。', nextTurns, heuristicTasks),
    )
  }
}
