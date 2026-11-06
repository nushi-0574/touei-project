'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import LoadingScreen from './LoadingScreen';

const MINIMUM_VISIBLE_MS = 650;
const NAVIGATION_TIMEOUT_MS = 15_000;

export default function NavigationLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationKey = `${pathname}?${searchParams.toString()}`;
  const [isNavigating, setIsNavigating] = useState(false);
  const startedAt = useRef<number | null>(null);
  const previousLocation = useRef(locationKey);
  const finishTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);

  useEffect(() => {
    const clearTimer = (timer: { current: number | null }) => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    const startNavigation = () => {
      if (startedAt.current === null) startedAt.current = Date.now();
      setIsNavigating(true);
      clearTimer(safetyTimer);
      safetyTimer.current = window.setTimeout(() => {
        startedAt.current = null;
        setIsNavigating(false);
      }, NAVIGATION_TIMEOUT_MS);
    };

    const handleClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      startNavigation();
    };

    const handlePopState = () => startNavigation();
    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
      clearTimer(finishTimer);
      clearTimer(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (previousLocation.current === locationKey) return;
    previousLocation.current = locationKey;

    const navigationStartedAt = startedAt.current ?? Date.now();
    startedAt.current = navigationStartedAt;
    setIsNavigating(true);
    if (safetyTimer.current !== null) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
    if (finishTimer.current !== null) window.clearTimeout(finishTimer.current);

    const remainingTime = Math.max(0, MINIMUM_VISIBLE_MS - (Date.now() - navigationStartedAt));
    finishTimer.current = window.setTimeout(() => {
      startedAt.current = null;
      finishTimer.current = null;
      setIsNavigating(false);
    }, remainingTime);
  }, [locationKey]);

  return isNavigating ? <LoadingScreen /> : null;
}
