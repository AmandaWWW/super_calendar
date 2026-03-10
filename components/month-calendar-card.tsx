'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { format, isSameDay, parseISO } from 'date-fns'
import type { EventContentArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useEffect, useRef } from 'react'
import { useVibeStore } from '@/stores/use-vibe-store'

export function MonthCalendarCard() {
  const { selectedDate, events, setSelectedDate } = useVibeStore()
  const calendarRef = useRef<FullCalendar | null>(null)

  useEffect(() => {
    calendarRef.current?.getApi().gotoDate(selectedDate)
  }, [selectedDate])

  return (
    <section className="panel sidebar-panel theme-month-calendar">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Month View</p>
          <h2 className="mt-2 text-lg font-semibold text-white">总览月历</h2>
        </div>
        <span className="hud-chip">{format(parseISO(selectedDate), 'yyyy.MM')}</span>
      </div>

      <div className="panel-body">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={selectedDate}
          headerToolbar={{ left: 'prev,next', center: 'title', right: '' }}
          fixedWeekCount={false}
          height="auto"
          dayMaxEvents={3}
          displayEventTime={false}
          selectable
          events={events as EventInput[]}
          eventContent={(arg: EventContentArg) => {
            const palette = ['bg-purple-200', 'bg-sky-200', 'bg-teal-200']
            const sameDayCount = events.filter((event) => {
              if (!event.start) return false
              return isSameDay(new Date(String(event.start)), arg.event.start ?? new Date())
            }).length

            return (
              <div className="flex items-center gap-1 px-0.5 py-0.5">
                <span className={`h-2.5 w-2.5 rounded-full ${palette[sameDayCount % palette.length]}`} />
              </div>
            )
          }}
          dateClick={(arg: DateClickArg) => setSelectedDate(format(arg.date, 'yyyy-MM-dd'))}
        />
      </div>
    </section>
  )
}
