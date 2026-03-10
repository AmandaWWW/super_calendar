import { format, parseISO } from 'date-fns'
import { createEvents, type EventAttributes } from 'ics'
import type { CalendarEvent, ProposedTask } from '@/lib/calendar-types'

function downloadBlob(filename: string, content: BlobPart, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function toLocalDateArray(value: string | Date) {
  const date = typeof value === 'string' ? parseISO(value) : value

  return [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
  ] as [number, number, number, number, number]
}

export function downloadTasksAsMarkdown(tasks: ProposedTask[]) {
  const lines = [
    '# Vibe Calendar Task Board',
    '',
    ...tasks.map((task) => {
      const start = format(parseISO(task.startTime), 'yyyy-MM-dd HH:mm')
      const end = format(parseISO(task.endTime), 'HH:mm')
      return `- [ ] ${task.title}：${task.description} (${start} - ${end})`
    }),
    '',
  ]

  downloadBlob('vibe-task-board.md', lines.join('\n'), 'text/markdown;charset=utf-8')
}

export function downloadTasksAsJson(tasks: ProposedTask[]) {
  downloadBlob('vibe-task-board.json', JSON.stringify(tasks, null, 2), 'application/json;charset=utf-8')
}

export function downloadEventsAsIcs(events: CalendarEvent[]) {
  const icsEvents: EventAttributes[] = events
    .filter((event) => event.start && event.end)
    .map((event) => ({
      uid: String(event.id ?? crypto.randomUUID()),
      title: String(event.title ?? 'Vibe Calendar Event'),
      description:
        typeof event.extendedProps === 'object' &&
        event.extendedProps !== null &&
        'description' in event.extendedProps &&
        typeof event.extendedProps.description === 'string'
          ? event.extendedProps.description
          : 'Exported from Vibe Calendar.',
      start: toLocalDateArray(event.start as string | Date),
      end: toLocalDateArray(event.end as string | Date),
      startOutputType: 'local',
      endOutputType: 'local',
      productId: 'Vibe Calendar',
      calName: 'Vibe Calendar',
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
    }))

  if (!icsEvents.length) {
    throw new Error('当前日历没有可导出的日程。')
  }

  const { error, value } = createEvents(icsEvents, {
    calName: 'Vibe Calendar',
    productId: 'Vibe Calendar',
  })

  if (error || !value) {
    throw error ?? new Error('ICS 文件生成失败。')
  }

  downloadBlob('vibe-plan.ics', value, 'text/calendar;charset=utf-8')
}
