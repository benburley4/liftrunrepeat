'use client'

// Client-side shared store for the signed-in user's volume multiplier
// overrides and best logged e1RMs. Loaded once per page load and shared by
// every component, so changing a multiplier updates all volume totals at once.

import { useEffect, useSyncExternalStore } from 'react'
import { getSessions, getSetting, upsertSetting } from './db'
import type { VolumeMultipliers } from './exerciseLoad'
import { bestLoggedE1RMs } from './trainingMaxes'

const SETTING_KEY = 'volume_multipliers'
const EMPTY_BESTS = new Map<string, number>()

let multipliers: VolumeMultipliers = {}
let bests: Map<string, number> = EMPTY_BESTS
let multipliersLoad: Promise<void> | null = null
let bestsLoad: Promise<void> | null = null
const listeners = new Set<() => void>()

const emit = () => listeners.forEach(l => l())
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

function loadMultipliers() {
  multipliersLoad ??= getSetting(SETTING_KEY)
    .then(raw => {
      const parsed = raw ? JSON.parse(raw) : {}
      multipliers = parsed && typeof parsed === 'object' ? parsed : {}
      emit()
    })
    .catch(console.error)
}

function loadBests() {
  bestsLoad ??= getSessions()
    .then(sessions => { bests = bestLoggedE1RMs(sessions); emit() })
    .catch(console.error)
}

/** The user's per-exercise volume multiplier overrides (empty until loaded). */
export function useVolumeMultipliers(): VolumeMultipliers {
  useEffect(loadMultipliers, [])
  return useSyncExternalStore(subscribe, () => multipliers, () => multipliers)
}

/** Best logged e1RM per exercise (lowercased name → kg; empty until loaded). */
export function useBestE1RMs(): Map<string, number> {
  useEffect(loadBests, [])
  return useSyncExternalStore(subscribe, () => bests, () => EMPTY_BESTS)
}

/** Set (or clear with null, reverting to the default) one exercise's multiplier. */
export async function saveVolumeMultiplier(name: string, value: number | null): Promise<void> {
  const key = name.trim().toLowerCase()
  const next = { ...multipliers }
  if (value == null) delete next[key]
  else next[key] = value
  multipliers = next
  emit()
  await upsertSetting(SETTING_KEY, JSON.stringify(next))
}
