export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  if (error && typeof error === 'object' && 'type' in error) {
    return fallback
  }

  if (typeof error === 'string' && error.trim()) {
    return error
  }

  return fallback
}
