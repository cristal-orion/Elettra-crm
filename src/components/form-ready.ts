"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
/** Un form con payload JSON diventa modificabile quando gli handler sono attivi. */
export function useFormReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
