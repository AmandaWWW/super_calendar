import type { EventInput } from '@fullcalendar/core'

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
}

export type AiStatus = 'idle' | 'analyzing' | 'generating'

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

export type PlannerApiStatus = 'generated'

export type PlannerApiResponse = {
  status: PlannerApiStatus
  message: string
  tasks: ProposedTask[]
}
