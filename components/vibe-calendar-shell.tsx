'use client'

import { AiGoalPanel } from '@/components/ai-goal-panel'
import { LunarConverterCard } from '@/components/lunar-converter-card'
import { MonthCalendarCard } from '@/components/month-calendar-card'
import { TaskBoardPanel } from '@/components/task-board-panel'
import { WeekCalendarBoard } from '@/components/week-calendar-board'

export function VibeCalendarShell() {
  return (
    <main className="shell-frame">
      <div className="shell-inner">
        <header className="panel-strong overflow-hidden p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <p className="eyebrow">Vibe Calendar</p>
              <h1 className="font-display text-4xl uppercase tracking-[0.14em] text-slate-800 md:text-5xl">
                Cyber Planner OS
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="hud-chip">1. 先选日期</span>
              <span className="hud-chip">2. 再生成任务</span>
              <span className="hud-chip">3. 应用到周历</span>
              <span className="hud-chip">4. 一键导出</span>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_420px]">
          <aside className="space-y-6">
            <LunarConverterCard />
            <MonthCalendarCard />
          </aside>

          <section className="min-w-0">
            <WeekCalendarBoard />
          </section>

          <aside className="space-y-6">
            <AiGoalPanel />
            <TaskBoardPanel />
          </aside>
        </div>
      </div>
    </main>
  )
}
