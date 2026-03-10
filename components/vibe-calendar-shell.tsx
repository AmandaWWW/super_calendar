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
                <h1 className="font-display text-4xl uppercase tracking-[0.14em] text-white md:text-5xl">
                  Cyber Planner OS
                </h1>
                <p className="max-w-3xl text-sm leading-7 text-muted md:text-base">
                  阴阳历转换、周视图排程、AI 目标规划被重组进同一张控制台。当前这一版先完成框架升级、
                  主题、三栏骨架和基础功能迁移，下一步再把跨面板状态机和冲突检测补上。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="hud-chip">Next.js App Router</span>
              <span className="hud-chip">FullCalendar</span>
              <span className="hud-chip">Zustand</span>
              <span className="hud-chip">Neo-Skeuomorphic Dark UI</span>
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
