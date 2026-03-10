declare module 'lunar-javascript' {
  type SolarLike = {
    getYear(): number
    getMonth(): number
    getDay(): number
    getLunar(): LunarLike
  }

  type LunarLike = {
    getYear(): number
    getMonth(): number
    getDay(): number
    getSolar(): SolarLike
    getYearInChinese(): string
    getMonthInChinese(): string
    getDayInChinese(): string
    getYearInGanZhi(): string
    getMonthInGanZhi(): string
    getDayInGanZhi(): string
    getJieQi(): string | null
  }

  export const Lunar: {
    fromDate(date: Date): LunarLike
    fromYmd(year: number, month: number, day: number): LunarLike
  }

  export const Solar: {
    fromYmd(year: number, month: number, day: number): SolarLike
  }
}
