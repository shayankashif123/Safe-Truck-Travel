import { useEffect, useState } from 'react'

import { apiGet } from '../api/client'

export type ApiHealth = 'checking' | 'online' | 'offline'

export function useApiHealth(): ApiHealth {
  const [health, setHealth] = useState<ApiHealth>('checking')

  useEffect(() => {
    const controller = new AbortController()

    apiGet<{ status: string }>('/api/health/', controller.signal)
      .then((body) => setHealth(body.status === 'ok' ? 'online' : 'offline'))
      .catch(() => {
        // An abort means the component unmounted, which is not an outage.
        if (!controller.signal.aborted) setHealth('offline')
      })

    return () => controller.abort()
  }, [])

  return health
}
