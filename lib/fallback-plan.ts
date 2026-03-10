import { addDays, differenceInCalendarDays, format, getDay } from 'date-fns'
import { Lunar } from 'lunar-javascript'
import type { DailyHint, PlanData, PlanItem } from '@/lib/calendar-types'

export function buildFallbackPlan(goal: string, startDate: string, endDate: string, weeklyHours: number): PlanData {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1)
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7))
  const totalHours = Math.max(1, totalWeeks * weeklyHours)

  const stageOne = Math.max(1, Math.floor(totalDays * 0.2))
  const stageTwo = Math.max(1, Math.floor(totalDays * 0.6))

  const stageOneEnd = addDays(start, stageOne - 1)
  const stageTwoEnd = addDays(stageOneEnd, stageTwo)

  const stages: PlanItem[] = [
    {
      title: '阶段 1 · 目标拆解与资源准备',
      start: format(start, 'yyyy-MM-dd'),
      end: format(stageOneEnd, 'yyyy-MM-dd'),
      hours: Math.round(totalHours * 0.2),
      note: '明确验收标准，锁定依赖资源，列出关键风险。',
    },
    {
      title: '阶段 2 · 核心推进与里程碑输出',
      start: format(addDays(stageOneEnd, 1), 'yyyy-MM-dd'),
      end: format(stageTwoEnd, 'yyyy-MM-dd'),
      hours: Math.round(totalHours * 0.6),
      note: '按周输出可见成果，避免一次性堆积未验证工作。',
    },
    {
      title: '阶段 3 · 收尾优化与交付复盘',
      start: format(addDays(stageTwoEnd, 1), 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
      hours: Math.max(1, totalHours - Math.round(totalHours * 0.2) - Math.round(totalHours * 0.6)),
      note: '预留缓冲时间处理返工、补文档、做交付复盘。',
    },
  ]

  const daily: DailyHint[] = []

  for (let index = 0; index < Math.min(totalDays, 14); index += 1) {
    const current = addDays(start, index)
    const lunar = Lunar.fromDate(current)
    const weekday = getDay(current)
    const lunarDay = lunar.getDay()
    const tip =
      weekday === 0 || weekday === 6
        ? '轻量推进 + 复盘校准'
        : lunarDay === 1 || lunarDay === 15
          ? '适合回顾阶段目标并修正计划'
          : '安排关键执行时段，避免打断'

    daily.push({
      date: format(current, 'yyyy-MM-dd'),
      lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      tip,
    })
  }

  return {
    summary: `目标「${goal}」预计 ${totalDays} 天完成，建议总投入约 ${totalHours} 小时（每周 ${weeklyHours} 小时）。`,
    stages,
    daily,
    from: 'fallback',
  }
}
