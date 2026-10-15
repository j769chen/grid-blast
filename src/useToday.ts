import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { dayNumber } from './daily';

export function useToday() {
  const [today, setToday] = useState(() => dayNumber(new Date()));
  useEffect(() => {
    let midnight: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const now = new Date();
      setToday(dayNumber(now));
      clearTimeout(midnight);
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnight = setTimeout(check, next.getTime() - now.getTime() + 1000);
    };
    check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });
    return () => {
      clearTimeout(midnight);
      sub.remove();
    };
  }, []);
  return today;
}
