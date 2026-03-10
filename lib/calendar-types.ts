import type { EventInput } from '@fullcalendar/core'

export type PlanItem = {
  title: string
  start: string
  end: string
  hours: number
  note: string
}

export type DailyHint = {
  date: string
  lunar: string
  tip: string
}

export type PlanData = {
  summary: string
  stages: PlanItem[]
  daily: DailyHint[]
  from: 'ai' | 'fallback'
}

export type PlannerForm = {
  goal: string
  startDate: string
  endDate: string
  weeklyHours: number
}

export type LunarForm = {
  year: number
  month: number
  day: number
  isLeapMonth: boolean
}

export type CalendarEvent = EventInput

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  countsTowardRound?: boolean
}

export type AiStatus = 'idle' | 'analyzing' | 'clarifying' | 'generating'

export type ProposedTask = {
  id: string
  title: string
  startTime: string
  endTime: string
  description: string
}

export type ConflictRecord = {
  taskId: string
  taskTitle: string
  eventId: string
  eventTitle: string
  startTime: string
  endTime: string
}

export type PlannerApiStatus = 'blocked' | 'clarify' | 'generated'

export type PlannerApiResponse = {
  status: PlannerApiStatus
  message: string
  countsTowardRound: boolean
  nextAiStatus: AiStatus
  goalTurns: number
  tasks?: ProposedTask[]
}
