import { NextResponse } from 'next/server'
import type { CalendarEvent, ChatMessage, PlannerApiResponse, ProposedTask } from '@/lib/calendar-types'
import { buildDefaultTasks } from '@/lib/task-planning'

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

function needsClarification(input: string, chatHistory: ChatMessage[]) {
  const combined = [input, ...chatHistory.map((item) => item.content)].join(' ')
  const shortGoal = combined.replace(/\s+/g, '').length < 18
  const lacksDeliverable = !/(完成|上线|交付|掌握|学会|开发|做出|搭建|写完|通过|复习|设计|发布|准备)/.test(combined)
  const tooBroad = /(提升自己|搞懂技术|学编程|做项目|学会 next|学习一下|试试看)/i.test(combined)

  return shortGoal || lacksDeliverable || tooBroad
}

function buildClarifyingQuestion(input: string, turns: number) {
  if (turns === 1) {
    return `你的目标是「${input}」，但还不够具体。请补充你最想达成的最终交付物，例如上线页面、完成课程、交付原型或通过考试。`
  }

  return '再补一条关键信息：你希望每天或每周如何分配时间，以及你最不能被打断的时间段是什么？'
}

function normalizeTasks(tasks: unknown): ProposedTask[] {
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
}

export async function POST(request: Request) {
  const apiKey = process.env.BAILIAN_API_KEY
  const model = process.env.BAILIAN_MODEL || 'deepseek-v3.1'
  const body = await request.json()
  const {
    userInput,
    plannerForm,
    chatHistory = [],
    goalTurns = 0,
    forceGenerate = false,
    busySlots = [],
  } = body || {}

  const { goal, startDate, endDate, weeklyHours } = plannerForm || {}

  if (!userInput || !goal || !startDate || !endDate || !weeklyHours) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (isChatter(userInput)) {
    const response: PlannerApiResponse = {
      status: 'blocked',
      message: '本面板专注为您生成日程计划，请告诉我您的具体项目或学习目标。',
      countsTowardRound: false,
      nextAiStatus: 'idle',
      goalTurns,
    }

    return NextResponse.json(response)
  }

  const nextTurns = forceGenerate ? Math.max(goalTurns, 3) : goalTurns + 1

  if (!forceGenerate && nextTurns < 3 && needsClarification(userInput, chatHistory)) {
    const response: PlannerApiResponse = {
      status: 'clarify',
      message: buildClarifyingQuestion(userInput, nextTurns),
      countsTowardRound: true,
      nextAiStatus: 'clarifying',
      goalTurns: nextTurns,
    }

    return NextResponse.json(response)
  }

  const fallbackTasks = buildDefaultTasks({
    goal,
    startDate,
    endDate,
    weeklyHours,
    busySlots: (busySlots as CalendarEvent[]).map((slot) => ({
      start: String(slot.start),
      end: String(slot.end),
      title: String(slot.title ?? '已有日程'),
    })),
  })

  if (!apiKey) {
    const response: PlannerApiResponse = {
      status: 'generated',
      message: '未配置大模型密钥，已基于当前上下文生成一份默认可执行计划。',
      countsTowardRound: true,
      nextAiStatus: 'generating',
      goalTurns: nextTurns,
      tasks: fallbackTasks,
    }

    return NextResponse.json(response)
  }

  const systemPrompt = [
    '你是 Vibe Calendar 的项目排期助手。',
    '你必须为用户生成可以直接放入日历的任务数组。',
    '你的输出必须是严格 JSON 数组，不要 markdown，不要解释文字，不要代码块。',
    '输出 schema：[{ "id":"uuid", "title":"任务名", "startTime":"ISO格式", "endTime":"ISO格式", "description":"细节" }]',
    '请结合用户的目标、开始日期、结束日期、每周可投入时间和既有忙碌时段生成任务。',
    '如果存在 busySlots，必须严格避开这些忙碌时段。',
    '请同时考虑人类正常作息，避免安排深夜任务，并默认预留 12:00-13:30 午餐和 23:00-08:00 睡眠时段。',
    '任务数量控制在 4 到 8 个之间，安排合理且可执行。',
  ].join('\n')

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: JSON.stringify({
              userInput,
              plannerForm,
              chatHistory,
              goalTurns: nextTurns,
              busySlots,
              mode: forceGenerate ? 'force-generate' : 'normal-generate',
            }),
          },
        ],
      }),
    })

    if (!response.ok) {
      const fallbackResponse: PlannerApiResponse = {
        status: 'generated',
        message: 'AI 接口异常，已使用默认计划填充待确认任务。',
        countsTowardRound: true,
        nextAiStatus: 'generating',
        goalTurns: nextTurns,
        tasks: fallbackTasks,
      }

      return NextResponse.json(fallbackResponse)
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content || ''
    const tasks = normalizeTasks(extractJsonArray(content))

    if (!tasks.length) {
      const fallbackResponse: PlannerApiResponse = {
        status: 'generated',
        message: 'AI 返回格式异常，已改用默认任务草案。',
        countsTowardRound: true,
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
      countsTowardRound: true,
      nextAiStatus: 'generating',
      goalTurns: nextTurns,
      tasks,
    }

    return NextResponse.json(plannerResponse)
  } catch (error) {
    const fallbackResponse: PlannerApiResponse = {
      status: 'generated',
      message: '服务端暂时不可用，已根据现有上下文生成默认任务。',
      countsTowardRound: true,
      nextAiStatus: 'generating',
      goalTurns: nextTurns,
      tasks: fallbackTasks,
    }

    return NextResponse.json(fallbackResponse)
  }
}
