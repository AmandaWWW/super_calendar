'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { format, parseISO } from 'date-fns'
import type { EventInput } from '@fullcalendar/core'
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
          dayMaxEvents={2}
          selectable
          events={events as EventInput[]}
          dateClick={(arg: DateClickArg) => setSelectedDate(format(arg.date, 'yyyy-MM-dd'))}
        />
      </div>
    </section>
  )
}
