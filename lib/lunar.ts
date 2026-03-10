import { format, parseISO } from 'date-fns'
import { Lunar, Solar } from 'lunar-javascript'

export function getLunarText(dateStr: string) {
  const date = parseISO(dateStr)
  const solar = Solar.fromYmd(date.getFullYear(), date.getMonth() + 1, date.getDate())
  const lunar = solar.getLunar()

  return {
    text: `${lunar.getYearInChinese()}年 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
    gz: `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
    jieQi: lunar.getJieQi() || '无',
    month: Math.abs(lunar.getMonth()),
    day: lunar.getDay(),
    year: lunar.getYear(),
  }
}

export function lunarToSolarText(year: number, month: number, day: number, isLeapMonth: boolean) {
  try {
    const normalizedMonth = isLeapMonth ? -Math.abs(month) : Math.abs(month)
    const lunar = Lunar.fromYmd(year, normalizedMonth, day)
    const solar = lunar.getSolar()

    return format(new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay()), 'yyyy-MM-dd')
  } catch {
    return '输入日期无效，请检查闰月与日期范围'
  }
}
