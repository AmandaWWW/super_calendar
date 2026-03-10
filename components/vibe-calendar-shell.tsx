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
              <div className="space-y-2">
                <h1 className="font-display text-4xl uppercase tracking-[0.14em] text-slate-800 md:text-5xl">
                  Cyber Planner OS
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-slate-500 md:text-base">
                  左侧先选日期并查看阴阳历信息，中间安排一周时间块，右侧再让 AI 帮你拆目标、出任务、导出清单。
                  整个页面围绕一个日期和一份计划联动，适合快速排学习、项目和交付节奏。
                </p>
              </div>
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
