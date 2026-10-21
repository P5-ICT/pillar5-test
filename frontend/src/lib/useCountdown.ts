import { useEffect, useRef, useState } from "react";

/**
 * Counts down to a deadline using the server's clock, so a wrong clock on the student's
 * computer cannot give them more or less time. Calls onZero once when time runs out.
 */
export function useCountdown(deadlineIso: string | null, serverTimeIso: string | null, onZero: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const firedRef = useRef(false);
  const onZeroRef = useRef(onZero);
  onZeroRef.current = onZero;

  useEffect(() => {
    if (!deadlineIso || !serverTimeIso) {
      setRemaining(null);
      return;
    }
    firedRef.current = false;
    const deadline = new Date(deadlineIso).getTime();
    const offset = new Date(serverTimeIso).getTime() - Date.now();
    const tick = () => {
      const left = deadline - (Date.now() + offset);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onZeroRef.current();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadlineIso, serverTimeIso]);

  return remaining;
}
