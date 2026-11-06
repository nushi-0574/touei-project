'use client';

import { useEffect, useState } from 'react';

export function useCurrentYear(): number {
  const [year, setYear] = useState(2026);

  useEffect(() => {
    const timer = window.setTimeout(() => setYear(new Date().getFullYear()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return year;
}
