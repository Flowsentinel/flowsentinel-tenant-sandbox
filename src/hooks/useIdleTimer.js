import { useEffect, useRef, useState, useCallback } from 'react'

// const IDLE_MS   = 10 * 60 * 1000   // 10 minutes until the warning appears
// const WARNING_S = 5  * 60          // 5-minute countdown (in seconds)

const IDLE_MS   = 15 * 1000  // ← testing value; restore to 10 * 60 * 1000 for production
const WARNING_S = 10         // ← testing value; restore to 5 * 60 for production

/**
 * Tracks user inactivity.
 *
 * - After IDLE_MS of no activity  → showWarning becomes true, countdown starts
 * - After WARNING_S more seconds  → onLogout() is called automatically
 * - Any user activity OR keepAlive() call → resets everything
 *
 * @param {{ onLogout: () => void }} options
 * @returns {{ showWarning: boolean, secondsLeft: number, keepAlive: () => void }}
 */
export function useIdleTimer({ onLogout }) {
  const [showWarning, setShowWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(WARNING_S)

  const warnTimerRef = useRef(null)
  const countdownRef = useRef(null)
  const secsRef      = useRef(WARNING_S)
  const onLogoutRef  = useRef(onLogout)

  // Keep the logout callback ref current without triggering re-renders
  useEffect(() => { onLogoutRef.current = onLogout }, [onLogout])

  const stopCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const startCountdown = useCallback(() => {
    secsRef.current = WARNING_S
    setSecondsLeft(WARNING_S)
    setShowWarning(true)
    stopCountdown()
    countdownRef.current = setInterval(() => {
      secsRef.current -= 1
      setSecondsLeft(secsRef.current)
      if (secsRef.current <= 0) {
        stopCountdown()
        onLogoutRef.current?.()
      }
    }, 1000)
  }, [stopCountdown])

  const resetTimer = useCallback(() => {
    localStorage.setItem('fs-last-active', Date.now().toString())
    setShowWarning(false)
    stopCountdown()
    clearTimeout(warnTimerRef.current)
    secsRef.current = WARNING_S
    setSecondsLeft(WARNING_S)
    warnTimerRef.current = setTimeout(startCountdown, IDLE_MS)
  }, [startCountdown, stopCountdown])

  useEffect(() => {
    // mousemove intentionally excluded — moving the mouse should not reset the
    // idle timer or dismiss the warning dialog
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer() // kick off the first timer on mount
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(warnTimerRef.current)
      stopCountdown()
    }
  }, [resetTimer, stopCountdown])

  return { showWarning, secondsLeft, keepAlive: resetTimer }
}
