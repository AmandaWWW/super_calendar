import type { CalendarEvent, ChatMessage, PlannerApiResponse, PlannerForm } from '@/lib/calendar-types'

type RequestPlannerParams = {
  userInput: string
  plannerForm: PlannerForm
  chatHistory: ChatMessage[]
  forceGenerate?: boolean
  busySlots?: CalendarEvent[]
}

export async function requestPlanner(params: RequestPlannerParams): Promise<PlannerApiResponse> {
  const response = await fetch('/api/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.error || '规划接口调用失败')
  }

  return response.json()
}
