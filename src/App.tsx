import { useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { Lunar, Solar } from 'lunar-javascript'
import './App.css'

type PlanItem = {
  title: string
  start: string
  end: string
  hours: number
  note: string
}

type DailyHint = {
  date: string
  lunar: string
  tip: string
}

type PlanData = {
  summary: string
  stages: PlanItem[]
  daily: DailyHint[]
  from: 'ai' | 'fallback'
}

const fmt = (date: dayjs.Dayjs) => date.format('YYYY-MM-DD')

function getLunarText(dateStr: string) {
  const d = dayjs(dateStr)
  const solar = Solar.fromYmd(d.year(), d.month() + 1, d.date())
  const lunar = solar.getLunar()
  return {
    text: `${lunar.getYearInChinese()}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    gz: `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
    jieQi: lunar.getJieQi() || '无',
  }
}

function buildFallbackPlan(goal: string, startDate: string, endDate: string, weeklyHours: number): PlanData {
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  const totalDays = Math.max(1, end.diff(start, 'day') + 1)
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7))
  const totalHours = Math.max(1, totalWeeks * weeklyHours)

  const stageDays = [Math.max(1, Math.floor(totalDays * 0.2)), Math.max(1, Math.floor(totalDays * 0.6))]
  const s1End = start.add(stageDays[0] - 1, 'day')
  const s2End = s1End.add(stageDays[1], 'day')

  const stages: PlanItem[] = [
    {
      title: '阶段1: 拆解目标与准备资源',
      start: fmt(start),
      end: fmt(s1End),
      hours: Math.round(totalHours * 0.2),
      note: '明确验收标准，列出关键资料与工具。',
    },
    {
      title: '阶段2: 核心执行与里程碑推进',
      start: fmt(s1End.add(1, 'day')),
      end: fmt(s2End),
      hours: Math.round(totalHours * 0.6),
      note: '每周至少1个可见成果，遇阻及时降维分解。',
    },
    {
      title: '阶段3: 收尾优化与复盘交付',
      start: fmt(s2End.add(1, 'day')),
      end: fmt(end),
      hours: Math.max(1, totalHours - Math.round(totalHours * 0.2) - Math.round(totalHours * 0.6)),
      note: '留出缓冲处理风险，完成复盘和下一轮行动清单。',
    },
  ]

  const daily: DailyHint[] = []
  for (let i = 0; i < Math.min(totalDays, 14); i += 1) {
    const current = start.add(i, 'day')
    const lunar = Lunar.fromDate(current.toDate())
    const isWeekend = current.day() === 0 || current.day() === 6
    const lunarDay = lunar.getDay()
    const tip = isWeekend
      ? '轻量任务 + 复盘总结'
      : lunarDay === 1 || lunarDay === 15
        ? '适合阶段复盘与计划校准'
        : '推进核心任务'

    daily.push({
      date: fmt(current),
      lunar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      tip,
    })
  }

  return {
    summary: `目标「${goal}」预计周期 ${totalDays} 天，建议投入约 ${totalHours} 小时（每周 ${weeklyHours} 小时）。`,
    stages,
    daily,
    from: 'fallback',
  }
}

function App() {
  const today = dayjs().format('YYYY-MM-DD')
  const [solarDate, setSolarDate] = useState(today)

  const [lunarYear, setLunarYear] = useState(dayjs().year())
  const [lunarMonth, setLunarMonth] = useState(1)
  const [lunarDay, setLunarDay] = useState(1)
  const [isLeapMonth, setIsLeapMonth] = useState(false)

  const [goal, setGoal] = useState('3个月内完成一个可上线的小工具')
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(dayjs().add(90, 'day').format('YYYY-MM-DD'))
  const [weeklyHours, setWeeklyHours] = useState(10)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<PlanData>(() => buildFallbackPlan(goal, startDate, endDate, weeklyHours))

  const solarToLunar = useMemo(() => getLunarText(solarDate), [solarDate])

  const lunarToSolar = useMemo(() => {
    try {
      const month = isLeapMonth ? -Math.abs(lunarMonth) : Math.abs(lunarMonth)
      const lunar = Lunar.fromYmd(lunarYear, month, lunarDay)
      const solar = lunar.getSolar()
      return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`
    } catch (_err) {
      return '输入日期无效，请检查闰月与日期范围'
    }
  }, [isLeapMonth, lunarDay, lunarMonth, lunarYear])

  const handleGenerate = async () => {
    const fallback = buildFallbackPlan(goal, startDate, endDate, Number(weeklyHours) || 1)
    setLoading(true)
    setError('')

    try {
      const startLunar = getLunarText(startDate)
      const endLunar = getLunarText(endDate)

      const response = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          startDate,
          endDate,
          weeklyHours: Number(weeklyHours) || 1,
          lunarContext: {
            start: startLunar.text,
            end: endLunar.text,
          },
        }),
      })

      if (!response.ok) {
        throw new Error('AI接口调用失败，已使用本地规则计划')
      }

      const data = await response.json()
      if (!data?.plan?.summary || !Array.isArray(data?.plan?.stages) || !Array.isArray(data?.plan?.daily)) {
        throw new Error('AI返回格式异常，已使用本地规则计划')
      }

      setPlan({ ...data.plan, from: 'ai' })
    } catch (err) {
      setPlan(fallback)
      setError(err instanceof Error ? err.message : '生成失败，已切换本地规则')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="page">
      <h1>万能日历生成器 Demo</h1>
      <p className="subtitle">阳历/阴历转换 + 目标自动生成可执行计划（百炼 API + 本地回退）</p>

      <section className="card">
        <h2>1) 阳历与阴历查询</h2>
        <label>
          阳历日期
          <input type="date" value={solarDate} onChange={(e) => setSolarDate(e.target.value)} />
        </label>
        <div className="result">
          <p>阴历: {solarToLunar.text}</p>
          <p>干支: {solarToLunar.gz}</p>
          <p>节气: {solarToLunar.jieQi}</p>
        </div>
      </section>

      <section className="card">
        <h2>2) 阴历转阳历</h2>
        <div className="grid4">
          <label>
            年
            <input type="number" value={lunarYear} onChange={(e) => setLunarYear(Number(e.target.value))} />
          </label>
          <label>
            月
            <input
              type="number"
              min={1}
              max={12}
              value={lunarMonth}
              onChange={(e) => setLunarMonth(Number(e.target.value))}
            />
          </label>
          <label>
            日
            <input type="number" min={1} max={30} value={lunarDay} onChange={(e) => setLunarDay(Number(e.target.value))} />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={isLeapMonth} onChange={(e) => setIsLeapMonth(e.target.checked)} />
            闰月
          </label>
        </div>
        <div className="result">
          <p>对应阳历: {lunarToSolar}</p>
        </div>
      </section>

      <section className="card">
        <h2>3) 输入目标并自动生成计划</h2>
        <label>
          目标/项目
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} />
        </label>
        <div className="grid3">
          <label>
            开始日期
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            截止日期
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
          <label>
            每周可投入小时
            <input
              type="number"
              min={1}
              max={80}
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(Number(e.target.value))}
            />
          </label>
        </div>

        <button type="button" onClick={handleGenerate} disabled={loading} className="primary-btn">
          {loading ? '生成中...' : '使用 AI 生成计划'}
        </button>

        {error ? <p className="error">{error}</p> : null}

        <div className="result">
          <p>
            {plan.summary}
            <span className="badge">{plan.from === 'ai' ? 'AI生成' : '本地回退'}</span>
          </p>
          <h3>阶段计划</h3>
          <ul>
            {plan.stages.map((stage) => (
              <li key={stage.title}>
                <strong>{stage.title}</strong>
                <span>{` ${stage.start} ~ ${stage.end} · ${stage.hours}h`}</span>
                <div>{stage.note}</div>
              </li>
            ))}
          </ul>

          <h3>未来14天行动建议（结合日历）</h3>
          <ul>
            {plan.daily.map((d) => (
              <li key={d.date}>
                <strong>{d.date}</strong>
                <span>{`（农历 ${d.lunar}）`}</span>
                <div>{d.tip}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}

export default App
