"use client";

import { useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** Stable across SSR hydration — false until mounted. */
export function usePrefersReducedMotion() {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const preference = useReducedMotion();
  return mounted ? Boolean(preference) : false;
}
