import { NextResponse } from 'next/server'
import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, isAfter, parseISO } from 'date-fns'
import type { CalendarEvent, ChatMessage, PlannerApiResponse, ProposedTask } from '@/lib/calendar-types'
import { buildDefaultTasks } from '@/lib/task-planning'

export const runtime = 'nodejs'
export const maxDuration = 60

const DASHSCOPE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
const DEFAULT_MODEL_TIMEOUT_MS = 55_000
const parsedTimeoutMs = Number(process.env.PLANNER_MODEL_TIMEOUT_MS ?? DEFAULT_MODEL_TIMEOUT_MS)
const MODEL_TIMEOUT_MS = Number.isFinite(parsedTimeoutMs)
  ? Math.min(Math.max(parsedTimeoutMs, 5_000), 110_000)
  : DEFAULT_MODEL_TIMEOUT_MS

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
  domain: 'general' | 'fitness' | 'study' | 'errand' | 'project'
  sessionsPerWeek: number | null
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
  const weeklyMatch = userInput.match(/每周\s*([一二三四五六七八九十两\d]+)\s*(?:次|练|天|节|训)?/)
  if (weeklyMatch) {
    return parseLooseNumber(weeklyMatch[1])
  }

  const splitMatch = userInput.match(/([一二三四五六七八九十两\d]+)\s*分化/)
  if (splitMatch) {
    return parseLooseNumber(splitMatch[1])
  }

  return null
}

function inferDomain(input: string, chatHistory: ChatMessage[]): PlanningContext['domain'] {
  const combined = [input, ...chatHistory.map((item) => item.content)].join(' ')

  if (/(减脂|减重|体脂|塑形|增肌|训练|健身|有氧|力量|跑步|分化|体重|身高|kg|公斤|髋关节|损伤|疼痛|康复|恢复|卧推|深蹲|臀|肩|胸|背)/i.test(combined)) {
    return 'fitness'
  }

  if (/(学习|复习|备考|考试|课程|刷题|单词|背诵|论文|面试|训练营|读书|看书|研究课题)/i.test(combined)) {
    return 'study'
  }

  if (/(买菜|购物|采购|采买|囤货|超市|菜市场|备餐|做饭|跑腿|收纳|家务|清洁)/i.test(combined)) {
    return 'errand'
  }

  if (/(上线|开发|产品|项目|交付|原型|设计|测试|发布|实现|迭代|版本|PRD|需求|代码)/i.test(combined)) {
    return 'project'
  }

  return 'general'
}

function needsClarification(input: string, chatHistory: ChatMessage[]) {
  const combined = [input, ...chatHistory.map((item) => item.content)].join(' ')
  const compactLength = combined.replace(/\s+/g, '').length
  const hasConcreteGoal = /(完成|上线|交付|掌握|学会|开发|做出|搭建|写完|通过|复习|设计|发布|减脂|减重|塑形|增肌|训练|备赛|康复)/.test(
    combined,
  )
  const hasPlanningConstraint = /(天|周|月|次|分化|小时|分钟|kg|公斤|身高|体重|损伤|疼痛|时间段|频率|节奏)/i.test(combined)
  const tooBroad = /(提升自己|搞懂技术|学编程|做项目|学习一下|试试看|安排一下|想健身|想锻炼)/i.test(combined)

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
  const effectiveEndDate = inferRequestedEndDate(userInput, plannerForm.startDate ?? '', plannerForm.endDate ?? '')
  const durationDays = Math.max(1, differenceInCalendarDays(parseISO(effectiveEndDate), parseISO(plannerForm.startDate ?? '')) + 1)
  const durationWeeks = Math.max(1, Math.ceil(durationDays / 7))
  const requiredTaskCount = sessionsPerWeek && durationWeeks > 1 ? Math.min(durationWeeks * sessionsPerWeek, 60) : null
  const allowsProcurementTasks = domain === 'errand' || /(购买|买菜|购物|采购|采买|囤货|超市|菜市场|装备|器材)/i.test(userInput)

  return {
    domain,
    sessionsPerWeek,
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

  if (context.domain === 'fitness' || context.domain === 'study') {
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
    return tasks.length >= Math.max(8, Math.floor(context.requiredTaskCount * 0.85)) && spansWindow
  }

  if (context.durationWeeks >= 8) {
    return tasks.length >= 12 && spansWindow
  }

  return true
}

function buildSystemPrompt(context: PlanningContext) {
  const rules = [
    '你是 Vibe Calendar 的高级排期助手。',
    '你的职责是把用户目标转成可以直接放进日历的可执行任务数组。',
    '你只能输出严格 JSON 数组，不要 markdown，不要解释文字，不要代码块。',
    '输出 schema：[{ "id":"uuid", "title":"任务名", "startTime":"ISO格式", "endTime":"ISO格式", "description":"细节" }]',
    'title 要短而明确；description 只写 1 句执行说明，尽量控制在 40 个汉字以内。',
    '先判断用户目标更像哪一类：周期性执行计划、项目推进计划、学习计划、跑腿/采购计划，或者它们的混合。',
    '每个元素都必须是用户真正要执行的日程块，而不是泛泛建议。',
    '如果用户要求的是周期性计划，就按频率把整个周期铺满；如果用户要求的是项目计划，就给出分析、执行、测试、交付等真实工作块；如果用户要求的是买菜/采购/跑腿，采购任务本身就是有效执行项。',
    '除非用户明确要求，否则不要输出购买装备、下载 app、准备物资、搜集资料、制定计划这类非核心执行事项。',
    '必须覆盖 effectivePlannerForm.startDate 到 effectivePlannerForm.endDate 的整个周期，而不是只覆盖前几天或前几周。',
    '必须严格避开 busySlots，并默认预留 12:00-13:30 午餐和 23:00-08:00 睡眠时段。',
    '如果用户自然语言里给出了更长的周期或更明确的频率，优先服从用户自然语言，不要被默认表单窗口限制住。',
  ]

  if (context.requiredTaskCount) {
    rules.push(`用户给出了周期性频率；任务数目标是 ${context.requiredTaskCount} 条，至少也要覆盖绝大部分周期，不要只给前几次。`)
  }

  if (context.domain === 'fitness') {
    rules.push(
      '当前是训练/健身目标。每条任务都应该是一节真正的训练、恢复或阶段复盘 session，而不是行政事项。',
      '如果用户写了“每周 N 次”或“N 分化”，必须让任务节奏体现这个频率，并尽量覆盖完整周期。',
      '训练类任务标题请直接写清楚周次和训练主题，例如“第 3 周 · 训练 2 · 上肢拉 + 核心稳定”。',
      '如果用户提到伤病或疼痛限制，不要做医疗诊断；只安排保守、低冲击、可替代的训练内容，并在 description 中标注规避点。',
      '默认单次训练 45-90 分钟，强度和动作选择以安全和可持续为先，不要安排高冲击、爆发跳跃或明显加重伤处负担的内容。',
    )
  } else if (context.domain === 'study') {
    rules.push(
      '当前是学习/复习目标。任务应是可执行的学习块、练习块、复盘块、测验块，不要输出买书、下载资料、泛泛了解一下等空任务。',
      '如果用户给出考试/交付时间点，后半程必须有冲刺、回顾、模拟或查漏补缺安排。',
    )
  } else if (context.domain === 'errand') {
    rules.push(
      '当前是采购/跑腿/日常事务目标。采购、去超市、备餐、分拣、清洁等都可以是有效执行项，但要具体、顺路、可落地。',
      '优先把任务拆成可以出门就做的动作，不要输出空泛原则。',
    )
  } else if (context.domain === 'project') {
    rules.push(
      '当前是项目/交付目标。需求分析、实现、测试、联调、发布、复盘都可以是有效执行项，但必须具体，不要只写抽象标题。',
    )
  } else if (context.durationWeeks >= 8) {
    rules.push('这是中长期计划，任务数不能太少；请按周展开，保证后半程也有具体安排。')
  } else {
    rules.push('任务数量要足够支撑执行，不要只给里程碑标题。')
  }

  return rules.join('\n')
}

async function callPlannerModel(apiKey: string, model: string, systemPrompt: string, payload: Record<string, unknown>) {
  const response = await fetch(DASHSCOPE_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 5000,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify(payload),
        },
      ],
    }),
  })

  return response
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

  if (!forceGenerate && goalTurns > 0 && nextTurns < 3 && needsClarification(userInput, chatHistory)) {
    const response: PlannerApiResponse = {
      status: 'clarify',
      message: buildClarifyingQuestion(nextTurns),
      nextAiStatus: 'clarifying',
      goalTurns: nextTurns,
    }

    return NextResponse.json(response)
  }

  const fallbackTasks = buildDefaultTasks({
    goal: planningContext.effectivePlannerForm.goal,
    startDate: planningContext.effectivePlannerForm.startDate,
    endDate: planningContext.effectivePlannerForm.endDate,
    weeklyHours: planningContext.effectivePlannerForm.weeklyHours,
    busySlots: (busySlots as CalendarEvent[]).map((slot) => ({
      start: String(slot.start),
      end: String(slot.end),
      title: String(slot.title ?? '已有日程'),
    })),
    domain: planningContext.domain === 'fitness' ? 'fitness' : 'general',
    sessionsPerWeek: planningContext.sessionsPerWeek,
    hasInjuryConstraint: planningContext.hasInjuryConstraint,
  })

  if (!apiKey) {
    const response: PlannerApiResponse = {
      status: 'generated',
      message: '未配置大模型密钥，已基于当前上下文生成一份默认可执行计划。',
      nextAiStatus: 'generating',
      goalTurns: nextTurns,
      tasks: fallbackTasks,
    }

    return NextResponse.json(response)
  }

  const systemPrompt = buildSystemPrompt(planningContext)
  const basePayload = {
    userInput,
    plannerForm: planningContext.effectivePlannerForm,
    planningContext,
    chatHistory,
    goalTurns: nextTurns,
    busySlots,
    mode: forceGenerate ? 'force-generate' : 'normal-generate',
  }

  try {
    const firstResponse = await callPlannerModel(apiKey, model, systemPrompt, basePayload)

    if (!firstResponse.ok) {
      const fallbackResponse: PlannerApiResponse = {
        status: 'generated',
        message: 'AI 接口异常，已使用默认计划填充待确认任务。',
        nextAiStatus: 'generating',
        goalTurns: nextTurns,
        tasks: fallbackTasks,
      }

      return NextResponse.json(fallbackResponse)
    }

    const firstData = await firstResponse.json()
    const firstTasks = normalizeTasks(extractJsonArray(firstData?.choices?.[0]?.message?.content || ''), planningContext)

    let tasks = firstTasks

    if (!planHasEnoughCoverage(tasks, planningContext)) {
      const repairPrompt = `${systemPrompt}\n上一次输出覆盖不足。你必须补足整个周期，尤其是后半程，不要再只给前几周或少量任务。`
      const repairResponse = await callPlannerModel(apiKey, model, repairPrompt, {
        ...basePayload,
        repairInstruction: {
          previousTaskCount: tasks.length,
          requiredTaskCount: planningContext.requiredTaskCount,
          requiredCoverageEndDate: planningContext.effectivePlannerForm.endDate,
        },
      })

      if (repairResponse.ok) {
        const repairData = await repairResponse.json()
        const repairedTasks = normalizeTasks(extractJsonArray(repairData?.choices?.[0]?.message?.content || ''), planningContext)

        if (planHasEnoughCoverage(repairedTasks, planningContext)) {
          tasks = repairedTasks
        }
      }
    }

    if (!planHasEnoughCoverage(tasks, planningContext)) {
      const fallbackResponse: PlannerApiResponse = {
        status: 'generated',
        message: 'AI 输出的计划覆盖不足，已改用可执行的默认任务草案。',
        nextAiStatus: 'generating',
        goalTurns: nextTurns,
        tasks: fallbackTasks,
      }

      return NextResponse.json(fallbackResponse)
    }

    const plannerResponse: PlannerApiResponse = {
      status: 'generated',
      message: forceGenerate
        ? '已避开当前已知冲突时段重新生成任务草案，请确认后再应用到日历。'
        : '已生成一组待确认任务，请先在任务看板审核再应用到日历。',
      nextAiStatus: 'generating',
      goalTurns: nextTurns,
      tasks,
    }

    return NextResponse.json(plannerResponse)
  } catch {
    const fallbackResponse: PlannerApiResponse = {
      status: 'generated',
      message: '服务端暂时不可用，已根据现有上下文生成默认任务。',
      nextAiStatus: 'generating',
      goalTurns: nextTurns,
      tasks: fallbackTasks,
    }

    return NextResponse.json(fallbackResponse)
  }
}
