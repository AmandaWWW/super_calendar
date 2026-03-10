'use client'

import FullCalendar from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import { downloadEventsAsIcs } from '@/lib/exporters'
import { format } from 'date-fns'
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useEffect, useRef } from 'react'
import { useVibeStore } from '@/stores/use-vibe-store'

export function WeekCalendarBoard() {
  const { selectedDate, events, setSelectedDate, addCalendarBlock, setError } = useVibeStore()
  const calendarRef = useRef<FullCalendar | null>(null)

  useEffect(() => {
    calendarRef.current?.getApi().gotoDate(selectedDate)
  }, [selectedDate])

  return (
    <section className="panel-strong h-full">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Week Grid</p>
          <h2 className="mt-2 text-lg font-semibold text-white">周视图排程面板</h2>
          <p className="mt-2 text-sm text-muted">使用成熟组件库做小时级周视图，当前已支持点击日期和拖拽选区生成 Block。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="hud-chip">TimeGrid</span>
          <span className="hud-chip">Selectable</span>
          <span className="hud-chip">Editable (next step)</span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              try {
                downloadEventsAsIcs(events)
                setError('')
              } catch (error) {
                setError(error instanceof Error ? error.message : '日历导出失败。')
              }
            }}
          >
            导出日历 (.ics)
          </button>
        </div>
      </div>

      <div className="panel-body">
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          initialDate={selectedDate}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          slotMinTime="06:00:00"
          slotMaxTime="23:00:00"
          slotDuration="01:00:00"
          allDaySlot={false}
          nowIndicator
          selectable
          selectMirror
          editable
          height={840}
          events={events as EventInput[]}
          select={(arg: DateSelectArg) => addCalendarBlock(arg)}
          dateClick={(arg: DateClickArg) => setSelectedDate(format(arg.date, 'yyyy-MM-dd'))}
          eventClick={(arg: EventClickArg) => setSelectedDate(format(arg.event.start ?? new Date(), 'yyyy-MM-dd'))}
        />
      </div>
    </section>
  )
}
