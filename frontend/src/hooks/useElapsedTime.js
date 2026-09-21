import { useEffect, useState } from 'react'

const pad = (value) => String(value).padStart(2, '0')

// Time since startTime as HH:MM:SS, updated every second; 00:00:00 without a start time
export function useElapsedTime(startTime) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (!startTime) return
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const seconds = startTime ? Math.max(0, Math.floor((now - new Date(startTime)) / 1000)) : 0
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
}
