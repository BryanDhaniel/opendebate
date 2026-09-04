"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "opendebate-theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * In-page listeners. The native `storage` event only fires in *other* tabs, so
 * a toggle in this tab needs an explicit notification for other hook instances.
 */
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) listener();
}

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null; // storage disabled (private mode) — fall back to the OS value
  }
}

function readSystemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

/** Client snapshot: an explicit choice wins, otherwise follow the OS. */
function getSnapshot(): Theme {
  return readStoredTheme() ?? readSystemTheme();
}

/** Server snapshot. React resolves the real value right after hydration. */
function getServerSnapshot(): Theme {
  return "light";
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

/**
 * Theme state backed by an external store (localStorage + OS preference).
 *
 * `useSyncExternalStore` is used instead of an effect that calls setState:
 * it reads the correct value on the first client render, so there is no
 * cascading re-render and no flash of the wrong theme.
 */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Effects are for synchronising external systems — here, the <html> element.
  // Also covers changes originating outside React (OS switch, another tab).
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Non-fatal: the choice still applies for this session.
    }
    applyTheme(next); // immediate, so the toggle never waits for the effect
    emitChange();
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, toggleTheme, setTheme };
}
