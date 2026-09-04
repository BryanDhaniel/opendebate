"use client";

import { IconMoon, IconSun } from "@tabler/icons-react";
import { useTheme } from "@/lib/client/use-theme";

/**
 * Light/dark switch.
 *
 * The icons are swapped purely with CSS (`dark:` variant) so the correct one is
 * visible on first paint — before React hydrates — matching the class applied by
 * the blocking init script. The accessible label follows the resolved theme,
 * which `useSyncExternalStore` corrects immediately after hydration.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      aria-pressed={theme === "dark"}
      title="Toggle colour theme"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border bg-surface text-fg-muted transition-colors hover:border-border-strong hover:text-fg active:translate-y-px"
    >
      {/* Moon — shown in light mode */}
      <IconMoon
        aria-hidden="true"
        className="h-[18px] w-[18px] dark:hidden"
        stroke={1.8}
      />
      {/* Sun — shown in dark mode */}
      <IconSun
        aria-hidden="true"
        className="hidden h-[18px] w-[18px] dark:block"
        stroke={1.8}
      />
    </button>
  );
}
