import { format, formatISO, isValid, parse, parseISO } from 'date-fns'

const DATE_TIME_PATTERNS = [
  "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
  "yyyy-MM-dd'T'HH:mm:ssXXX",
  "yyyy-MM-dd'T'HH:mmXXX",
  "yyyy-MM-dd'T'HH:mm:ss",
  "yyyy-MM-dd'T'HH:mm",
  'yyyy-MM-dd HH:mm:ss',
  'yyyy-MM-dd HH:mm',
  'yyyy/MM/dd HH:mm:ss',
  'yyyy/MM/dd HH:mm',
  'yyyy.MM.dd HH:mm:ss',
  'yyyy.MM.dd HH:mm',
  'yyyy年M月d日 HH:mm',
  'yyyy年MM月dd日 HH:mm',
]

export function toDateOrNull(value: string | Date | null | undefined) {
  if (!value) return null

  if (value instanceof Date) {
    return isValid(value) ? value : null
  }

  const trimmed = value.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(/\u3000/g, ' ')

  const isoCandidate = parseISO(normalized)
  if (isValid(isoCandidate)) {
    return isoCandidate
  }

  for (const pattern of DATE_TIME_PATTERNS) {
    const parsed = parse(normalized, pattern, new Date())
    if (isValid(parsed)) {
      return parsed
    }
  }

  const native = new Date(normalized)
  if (isValid(native)) {
    return native
  }

  return null
}

export function normalizeDateTimeInput(value: string | Date | null | undefined) {
  const date = toDateOrNull(value)
  return date ? formatISO(date) : null
}

export function formatDateTimeValue(value: string | Date | null | undefined, pattern: string, fallback = '--') {
  const date = toDateOrNull(value)
  return date ? format(date, pattern) : fallback
}
