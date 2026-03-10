'use client'

import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { getLunarText, lunarToSolarText } from '@/lib/lunar'
import { useVibeStore } from '@/stores/use-vibe-store'

export function LunarConverterCard() {
  const { selectedDate, lunarForm, setSelectedDate, setLunarField } = useVibeStore()

  const solarDetails = useMemo(() => getLunarText(selectedDate), [selectedDate])
  const lunarResult = useMemo(
    () => lunarToSolarText(lunarForm.year, lunarForm.month, lunarForm.day, lunarForm.isLeapMonth),
    [lunarForm.day, lunarForm.isLeapMonth, lunarForm.month, lunarForm.year],
  )

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Converter</p>
          <h2 className="mt-2 text-lg font-semibold text-white">阴阳历转换器</h2>
        </div>
        <span className="metric-pill">Live</span>
      </div>

      <div className="panel-body space-y-6">
        <div className="space-y-3">
          <p className="section-label">Solar -&gt; Lunar</p>
          <input
            className="input-shell"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
          <div className="grid gap-3 rounded-[26px] border border-white/10 bg-black/20 p-4 text-sm text-muted">
            <div className="flex items-center justify-between gap-4">
              <span>阳历</span>
              <span className="font-medium text-white">{format(parseISO(selectedDate), 'yyyy.MM.dd')}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>阴历</span>
              <span className="font-medium text-white">{solarDetails.text}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>干支</span>
              <span className="font-medium text-white">{solarDetails.gz}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>节气</span>
              <span className="font-medium text-white">{solarDetails.jieQi}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>当前联动日期</span>
              <span className="font-medium text-neon">{selectedDate}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="section-label">Lunar -&gt; Solar</p>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="input-shell"
              type="number"
              value={lunarForm.year}
              onChange={(event) => setLunarField('year', Number(event.target.value))}
            />
            <label className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted">
              <input
                type="checkbox"
                checked={lunarForm.isLeapMonth}
                onChange={(event) => setLunarField('isLeapMonth', event.target.checked)}
              />
              闰月
            </label>
            <input
              className="input-shell"
              type="number"
              min={1}
              max={12}
              value={lunarForm.month}
              onChange={(event) => setLunarField('month', Number(event.target.value))}
            />
            <input
              className="input-shell"
              type="number"
              min={1}
              max={30}
              value={lunarForm.day}
              onChange={(event) => setLunarField('day', Number(event.target.value))}
            />
          </div>
          <div className="rounded-[24px] border border-ultraviolet/20 bg-ultraviolet/10 p-4 text-sm text-white">
            对应阳历：<span className="font-semibold">{lunarResult}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
