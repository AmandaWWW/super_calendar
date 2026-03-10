'use client'

import type { DateSelectArg } from '@fullcalendar/core'
import { addDays, addHours, format } from 'date-fns'
import { create } from 'zustand'
import type {
  AiStatus,
  CalendarEvent,
  ChatMessage,
  ConflictRecord,
  LunarForm,
  PlanData,
  PlannerForm,
  ProposedTask,
} from '@/lib/calendar-types'
import { buildFallbackPlan } from '@/lib/fallback-plan'
import { getLunarText } from '@/lib/lunar'
import { detectTaskConflicts, taskToCalendarEvent } from '@/lib/task-planning'

type VibeStore = {
  selectedDate: string
  plannerForm: PlannerForm
  lunarForm: LunarForm
  plan: PlanData
  events: CalendarEvent[]
  selectedEventId: string | null
  proposedTasks: ProposedTask[]
  chatHistory: ChatMessage[]
  aiStatus: AiStatus
  goalTurns: number
  loading: boolean
  error: string
  conflicts: ConflictRecord[]
  isConflictModalOpen: boolean
  setSelectedDate: (value: string) => void
  setPlannerField: <K extends keyof PlannerForm>(key: K, value: PlannerForm[K]) => void
  setLunarField: <K extends keyof LunarForm>(key: K, value: LunarForm[K]) => void
  setPlan: (plan: PlanData) => void
  setProposedTasks: (tasks: ProposedTask[]) => void
  removeProposedTask: (taskId: string) => void
  appendChatMessage: (message: ChatMessage) => void
  clearChatHistory: () => void
  setAiStatus: (value: AiStatus) => void
  setGoalTurns: (value: number) => void
  setLoading: (value: boolean) => void
  setError: (value: string) => void
  setSelectedEventId: (value: string | null) => void
  removeCalendarEvent: (eventId: string) => void
  closeConflictModal: () => void
  applyProposedTasks: (force?: boolean) => { applied: boolean; conflicts: ConflictRecord[] }
  addCalendarBlock: (arg: DateSelectArg) => void
}

const today = new Date()
const todayLabel = format(today, 'yyyy-MM-dd')
const todayLunar = getLunarText(todayLabel)

const initialPlannerForm: PlannerForm = {
  goal: '在 6 周内完成 Vibe Calendar 的 MVP，并上线可用演示版本。',
  startDate: todayLabel,
  endDate: format(addDays(today, 42), 'yyyy-MM-dd'),
  weeklyHours: 12,
}

const initialEvents: CalendarEvent[] = [
  {
    id: 'seed-sync',
    title: 'Product Sync',
    start: addHours(today, 10).toISOString(),
    end: addHours(today, 11).toISOString(),
  },
  {
    id: 'seed-build',
    title: 'Build Block',
    start: addHours(addDays(today, 1), 14).toISOString(),
    end: addHours(addDays(today, 1), 16).toISOString(),
  },
]

export const useVibeStore = create<VibeStore>((set) => ({
  selectedDate: todayLabel,
  plannerForm: initialPlannerForm,
  lunarForm: {
    year: todayLunar.year,
    month: todayLunar.month,
    day: todayLunar.day,
    isLeapMonth: false,
  },
  plan: buildFallbackPlan(
    initialPlannerForm.goal,
    initialPlannerForm.startDate,
    initialPlannerForm.endDate,
    initialPlannerForm.weeklyHours,
  ),
  events: initialEvents,
  selectedEventId: null,
  proposedTasks: [],
  chatHistory: [],
  aiStatus: 'idle',
  goalTurns: 0,
  loading: false,
  error: '',
  conflicts: [],
  isConflictModalOpen: false,
  setSelectedDate: (value) =>
    set(() => {
      const lunar = getLunarText(value)

      return {
        selectedDate: value,
        lunarForm: {
          year: lunar.year,
          month: lunar.month,
          day: lunar.day,
          isLeapMonth: false,
        },
      }
    }),
  setPlannerField: (key, value) =>
    set((state) => ({
      plannerForm: {
        ...state.plannerForm,
        [key]: value,
      },
    })),
  setLunarField: (key, value) =>
    set((state) => ({
      lunarForm: {
        ...state.lunarForm,
        [key]: value,
      },
    })),
  setPlan: (plan) => set({ plan }),
  setProposedTasks: (proposedTasks) => set({ proposedTasks }),
  removeProposedTask: (taskId) =>
    set((state) => ({
      proposedTasks: state.proposedTasks.filter((task) => task.id !== taskId),
    })),
  appendChatMessage: (message) =>
    set((state) => ({
      chatHistory: [...state.chatHistory, message],
    })),
  clearChatHistory: () => set({ chatHistory: [], goalTurns: 0, aiStatus: 'idle' }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  setGoalTurns: (goalTurns) => set({ goalTurns }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSelectedEventId: (selectedEventId) => set({ selectedEventId }),
  removeCalendarEvent: (eventId) =>
    set((state) => ({
      events: state.events.filter((event) => String(event.id) !== eventId),
      selectedEventId: state.selectedEventId === eventId ? null : state.selectedEventId,
    })),
  closeConflictModal: () => set({ isConflictModalOpen: false, conflicts: [] }),
  applyProposedTasks: (force = false) => {
    const { proposedTasks, events } = useVibeStore.getState()
    const conflicts = detectTaskConflicts(proposedTasks, events)

    if (conflicts.length > 0 && !force) {
      set({
        conflicts,
        isConflictModalOpen: true,
      })

      return { applied: false, conflicts }
    }

    set((state) => ({
      events: [...state.events, ...state.proposedTasks.map(taskToCalendarEvent)],
      proposedTasks: [],
      selectedEventId: null,
      conflicts: [],
      isConflictModalOpen: false,
    }))

    return { applied: true, conflicts: [] }
  },
  addCalendarBlock: (arg) =>
    set((state) => ({
      events: [
        ...state.events,
        {
          id: `block-${Date.now()}`,
          title: 'Focus Block',
          start: arg.startStr,
          end: arg.endStr,
        },
      ],
      selectedEventId: null,
    })),
}))
