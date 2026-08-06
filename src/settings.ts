/**
 * User preferences.
 *
 * These live in `localStorage` rather than the history store: they are a few
 * hundred bytes, every screen reads them during render, and an async read would
 * mean a visible flash of the wrong theme on every load.
 */

import { useCallback, useEffect, useState } from 'react'

import type { Difficulty, Side } from './engine/types'
import type { GameMode } from './game/useGame'

export interface Settings {
  difficulty: Difficulty
  mode: GameMode
  playerSide: Side
  /** Draw the board with Red at the bottom (false) or Black (true). */
  flipped: boolean
  sound: boolean
  /** Spoken commentary. Needs a network; the effects do not. */
  voice: boolean
  showHints: boolean
  /** Feed finished games back into the engine's experience book. */
  learnFromGames: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'master',
  mode: 'pve',
  playerSide: 'r',
  flipped: false,
  sound: true,
  voice: true,
  showHints: true,
  learnFromGames: true,
}

const KEY = 'co-tuong.settings.v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    // Merge over the defaults so a settings blob written by an older build,
    // missing newer keys, still yields a complete object.
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Private-browsing modes can refuse writes; preferences are not worth
    // failing the app over.
  }
}

/** Reactive settings, kept in sync across tabs. */
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings)

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSettings(loadSettings())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, update }
}
