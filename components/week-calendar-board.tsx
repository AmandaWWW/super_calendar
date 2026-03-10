'use client'

import FullCalendar from '@fullcalendar/react'
import interactionPlugin from '@fullcalendar/interaction'
import timeGridPlugin from '@fullcalendar/timegrid'
import type { EventContentArg } from '@fullcalendar/core'
import { getErrorMessage } from '@/lib/errors'
import { downloadEventsAsIcs } from '@/lib/exporters'
import { format, parseISO } from 'date-fns'
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
import { useEffect, useMemo, useRef } from 'react'
import { useVibeStore } from '@/stores/use-vibe-store'

export function WeekCalendarBoard() {
  const {
    selectedDate,
    events,
    setSelectedDate,
    addCalendarBlock,
    setError,
    selectedEventId,
    setSelectedEventId,
    removeCalendarEvent,
  } = useVibeStore()
  const calendarRef = useRef<FullCalendar | null>(null)
  const selectedEvent = useMemo(
    () => events.find((event) => String(event.id) === selectedEventId) ?? null,
    [events, selectedEventId],
  )

  useEffect(() => {
    calendarRef.current?.getApi().gotoDate(selectedDate)
  }, [selectedDate])

  return (
    <section className="panel-strong theme-week-calendar h-full">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Week Grid</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">周视图排程面板</h2>
          <p className="mt-2 text-sm text-slate-500">拖拽时间网格可以快速新增 block；点现有日程可在下方直接删除；导出 `.ics` 后可导入系统日历。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="hud-chip">{format(parseISO(selectedDate), 'yyyy.MM.dd')}</span>
          <span className="hud-chip">拖拽新增</span>
          <span className="hud-chip">点击删除</span>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              try {
                downloadEventsAsIcs(events)
                setError('')
              } catch (error) {
                setError(getErrorMessage(error, '日历导出失败。'))
              }
            }}
          >
            导出日历 (.ics)
          </button>
        </div>
      </div>

      <div className="panel-body space-y-5">
        <div className="grid gap-3 rounded-[24px] border border-white/80 bg-white/90 p-4 text-sm text-slate-500 shadow-2xl shadow-slate-200/60 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="section-label">使用方法</div>
            <p className="mt-2 leading-7">
              1. 从左侧月历选中某一天。
              2. 在这里拖出专注时间块，搭建你的真实时间预算。
              3. 再把右侧 AI 任务草案确认应用进来。
            </p>
          </div>
          <div className="rounded-[20px] border border-white/80 bg-white p-4 shadow-[0_18px_34px_rgba(148,163,184,0.14)]">
            <div className="section-label">已选日程</div>
            {selectedEvent ? (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{String(selectedEvent.title ?? '未命名日程')}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                    {selectedEvent.start ? format(new Date(String(selectedEvent.start)), 'MM.dd HH:mm') : '--'}
                    {'  '}-&gt;{'  '}
                    {selectedEvent.end ? format(new Date(String(selectedEvent.end)), 'HH:mm') : '--'}
                  </div>
                </div>
                <button
                  className="ghost-button w-full border-rose-100 text-rose-500 hover:bg-rose-50"
                  type="button"
                  onClick={() => removeCalendarEvent(String(selectedEvent.id))}
                >
                  删除这个日程
                </button>
              </div>
            ) : (
              <p className="mt-3 leading-6 text-slate-500">点击周视图中的任意日程，即可在这里执行删除。</p>
            )}
          </div>
        </div>

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
          editable={false}
          height={840}
          dayHeaderFormat={{ weekday: 'short', month: 'numeric', day: 'numeric' }}
          events={events as EventInput[]}
          eventContent={(arg: EventContentArg) => (
            <div className="space-y-1 px-1 py-0.5">
              <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{arg.timeText}</div>
              <div className="text-xs font-semibold text-current">{arg.event.title}</div>
            </div>
          )}
          select={(arg: DateSelectArg) => addCalendarBlock(arg)}
          dateClick={(arg: DateClickArg) => setSelectedDate(format(arg.date, 'yyyy-MM-dd'))}
          eventClick={(arg: EventClickArg) => {
            setSelectedDate(format(arg.event.start ?? new Date(), 'yyyy-MM-dd'))
            setSelectedEventId(String(arg.event.id))
          }}
        />
      </div>
    </section>
  )
}
