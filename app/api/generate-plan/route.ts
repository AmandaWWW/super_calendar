import { addHours, isAfter } from 'date-fns'
import { NextResponse } from 'next/server'
import type { CalendarEvent, ChatMessage, PlannerApiResponse, ProposedTask } from '@/lib/calendar-types'
import { normalizeDateTimeInput, toDateOrNull } from '@/lib/date-time'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = ['hkg1', 'sin1']

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
  forceGenerate?: boolean
  busySlots?: CalendarEvent[]
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

function normalizeTasks(tasks: unknown): ProposedTask[] {
  if (!Array.isArray(tasks)) return []

  return tasks
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const startTime = normalizeDateTimeInput(typeof item.startTime === 'string' ? item.startTime.trim() : '')
      let endTime = normalizeDateTimeInput(typeof item.endTime === 'string' ? item.endTime.trim() : '')

      if (!endTime && startTime) {
        const start = toDateOrNull(startTime)
        if (start) {
          endTime = normalizeDateTimeInput(addHours(start, 1))
        }
      }

      return {
        id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
        title: typeof item.title === 'string' ? item.title.trim() : '',
        startTime: startTime ?? '',
        endTime: endTime ?? '',
        description: typeof item.description === 'string' ? item.description.trim() : '',
      }
    })
    .filter((item) => item.title && item.startTime && item.endTime && item.description)
    .filter((item) => {
      const start = toDateOrNull(item.startTime)
      const end = toDateOrNull(item.endTime)
      return Boolean(start && end && isAfter(end, start))
    })
    .sort((left, right) => left.startTime.localeCompare(right.startTime))
}

function buildSystemPrompt() {
  return [
    '你是 Vibe Calendar 的排期助手。',
    '你的唯一任务是根据用户输入，生成可以直接放进日历的可执行任务数组。',
    '你只能输出严格 JSON 数组，不要输出 markdown、解释、标题、代码块或额外文字。',
    '输出 schema：[{"id":"uuid","title":"任务名","startTime":"YYYY-MM-DDTHH:mm:ss+08:00","endTime":"YYYY-MM-DDTHH:mm:ss+08:00","description":"执行说明"}]。',
    '每个任务必须是用户真正要执行的动作，而不是泛泛建议。',
    '优先服从用户自然语言中的目标、时长、频率、节奏、限制和截止时间。',
    '如果用户自然语言中的周期与表单默认周期冲突，以用户自然语言为准。',
    '如果用户没有给够细节，也不要改用其他类型的计划；应基于当前目标做一版保守但合理的安排。',
    '不要因为出现“学习”二字就自动做学习规划；必须按真实目标理解语义，例如“学习游泳”属于训练/技能练习计划，而不是考试复习。',
    '除非用户明确要求，否则不要加入购买装备、下载应用、搜集资料、制定计划这类非核心准备事项。',
    '如果传入了 busySlots，必须避开这些时间段。默认避免安排在 23:00-08:00 和 12:00-13:30。',
    '长周期目标请覆盖完整周期，但不要把单个长期计划展开成上百条；通常按周安排 2 到 6 个关键任务即可。',
    '每条任务都必须给出合法的开始时间和结束时间，且 endTime 必须晚于 startTime。',
    'title 简洁明确；description 只写 1 句具体执行说明。',
  ].join('\n')
}

function buildRepairPrompt() {
  return [
    '你是 JSON 修复助手。',
    '你的任务是把上一轮模型输出修正为严格 JSON 数组，不能改变原始规划意图。',
    '只输出 JSON 数组，不要任何解释。',
    '输出 schema：[{"id":"uuid","title":"任务名","startTime":"YYYY-MM-DDTHH:mm:ss+08:00","endTime":"YYYY-MM-DDTHH:mm:ss+08:00","description":"执行说明"}]。',
    '如果时间格式不是合法 ISO 8601，请改写成合法格式。',
    '如果 endTime 缺失，请在合理范围内补成比 startTime 晚 1 小时。',
    '如果某些任务完全无法修复时间，就删除这些任务，但尽量保留其余任务。',
  ].join('\n')
}

function buildUserPayload(
  userInput: string,
  plannerForm: NonNullable<PlannerRequestBody['plannerForm']>,
  chatHistory: ChatMessage[],
  busySlots: CalendarEvent[],
  forceGenerate: boolean,
) {
  return {
    userInput,
    plannerForm,
    conversationContext: chatHistory.slice(-6).map((item) => ({ role: item.role, content: item.content })),
    busySlots: busySlots
      .filter((slot) => slot.start && slot.end)
      .slice(0, 20)
      .map((slot) => ({
        title: String(slot.title ?? '已有日程'),
        start: String(slot.start),
        end: String(slot.end),
      })),
    mode: forceGenerate ? 'force-generate' : 'generate',
  }
}

async function callPlannerModel(
  apiKey: string,
  model: string,
  systemPrompt: string,
  payload: Record<string, unknown>,
  maxTokens = 5000,
) {
  return fetch(DASHSCOPE_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
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
        { role: 'user', content: JSON.stringify(payload) },
      ],
    }),
  })
}

async function repairPlannerOutput(
  apiKey: string,
  model: string,
  rawOutput: string,
  payload: Record<string, unknown>,
) {
  const response = await callPlannerModel(
    apiKey,
    model,
    buildRepairPrompt(),
    {
      originalRequest: payload,
      rawModelOutput: rawOutput,
    },
    3500,
  )

  if (!response.ok) return []

  const data = await response.json()
  return normalizeTasks(extractJsonArray(data?.choices?.[0]?.message?.content || ''))
}

function buildGeneratedResponse(message: string, tasks: ProposedTask[]): PlannerApiResponse {
  return {
    status: 'generated',
    message,
    tasks,
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.BAILIAN_API_KEY
  const model = process.env.BAILIAN_MODEL || 'deepseek-v3.1'
  const body = (await request.json()) as PlannerRequestBody
  const { userInput, plannerForm, chatHistory = [], forceGenerate = false, busySlots = [] } = body || {}

  const { goal, startDate, endDate, weeklyHours } = plannerForm || {}

  if (!userInput || !goal || !startDate || !endDate || !weeklyHours) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing BAILIAN_API_KEY' }, { status: 500 })
  }

  const safePlannerForm = plannerForm as NonNullable<PlannerRequestBody['plannerForm']>
  const systemPrompt = buildSystemPrompt()
  const payload = buildUserPayload(userInput, safePlannerForm, chatHistory, busySlots as CalendarEvent[], forceGenerate)

  try {
    const response = await callPlannerModel(apiKey, model, systemPrompt, payload, 5500)

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return NextResponse.json({ error: detail || 'Planner model request failed' }, { status: 502 })
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content || ''
    let tasks = normalizeTasks(extractJsonArray(content))

    if (!tasks.length && content) {
      tasks = await repairPlannerOutput(apiKey, model, content, payload)
    }

    if (!tasks.length) {
      return NextResponse.json({ error: 'Planner model did not return a valid task array' }, { status: 502 })
    }

    return NextResponse.json(
      buildGeneratedResponse(
        forceGenerate
          ? '已按当前输入重新生成任务草案，请确认后再应用到日历。'
          : '已生成一组待确认任务，请先在任务看板审核再应用到日历。',
        tasks,
      ),
    )
  } catch (error) {
    console.error('planner route error', error)
    return NextResponse.json({ error: 'Planner model request failed' }, { status: 502 })
  }
}
