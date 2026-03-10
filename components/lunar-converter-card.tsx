'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { getLunarText, lunarToSolarText } from '@/lib/lunar'
import { useVibeStore } from '@/stores/use-vibe-store'

export function LunarConverterCard() {
  const { selectedDate, lunarForm, setSelectedDate, setLunarField } = useVibeStore()
  const [mode, setMode] = useState<'solar' | 'lunar'>('solar')

  const solarDetails = useMemo(() => getLunarText(selectedDate), [selectedDate])
  const lunarResult = useMemo(
    () => lunarToSolarText(lunarForm.year, lunarForm.month, lunarForm.day, lunarForm.isLeapMonth),
    [lunarForm.day, lunarForm.isLeapMonth, lunarForm.month, lunarForm.year],
  )
  const activeSourceLabel = mode === 'solar' ? '阳历' : '阴历'
  const activeTargetLabel = mode === 'solar' ? '阴历' : '阳历'
  const swapDirection = () => {
    if (mode === 'solar') {
      setMode('lunar')
      return
    }

    if (!lunarResult.startsWith('输入日期无效')) {
      setSelectedDate(lunarResult)
    }

    setMode('solar')
  }

  return (
    <section className="panel sidebar-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Converter</p>
          <h2 className="mt-2 text-lg font-semibold text-white">阴阳历转换器</h2>
        </div>
        <span className="metric-pill">Live</span>
      </div>

      <div className="panel-body space-y-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-4">
            <div className="section-label">{activeSourceLabel}</div>
            <div className="mt-2 text-base font-semibold text-white">
              {mode === 'solar'
                ? format(parseISO(selectedDate), 'yyyy.MM.dd')
                : `${lunarForm.year}年 ${lunarForm.isLeapMonth ? '闰' : ''}${lunarForm.month}月${lunarForm.day}日`}
            </div>
          </div>
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 text-xl text-lime-300 transition hover:bg-zinc-800"
            type="button"
            onClick={swapDirection}
          >
            ⇄
          </button>
          <div className="rounded-[24px] border border-zinc-800 bg-zinc-900 p-4 text-right">
            <div className="section-label">{activeTargetLabel}</div>
            <div className="mt-2 text-base font-semibold text-white">
              {mode === 'solar' ? solarDetails.text : lunarResult}
            </div>
          </div>
        </div>

        {mode === 'solar' ? (
          <div className="space-y-3">
            <p className="section-label">输入阳历日期</p>
            <input
              className="input-shell"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="section-label">输入阴历日期</p>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="input-shell"
                type="number"
                value={lunarForm.year}
                onChange={(event) => setLunarField('year', Number(event.target.value))}
              />
              <label className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-400">
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
          </div>
        )}

        <div className="grid gap-3 rounded-[26px] border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
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
            <span className="font-medium text-lime-300">{selectedDate}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
