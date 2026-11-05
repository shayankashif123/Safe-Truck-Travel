import { useEffect, useState } from 'react'

/** The current time, refreshed every `refreshMs`, so renders stay pure. */
export function useNow(refreshMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), refreshMs)
    return () => clearInterval(timer)
  }, [refreshMs])

  return now
}
