"use client";

import { useEffect } from "react";

type Theme = "light" | "dark";

const THEME_KEY = "sachio_dashboard_theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle(
    "dashboard-theme-dark",
    theme === "dark"
  );
  document.body.classList.toggle("dashboard-theme-dark", theme === "dark");
}

export default function ThemeClient() {
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark") {
      applyTheme(stored);
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      applyTheme(prefersDark ? "dark" : "light");
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_KEY) return;
      if (event.newValue === "light" || event.newValue === "dark") {
        applyTheme(event.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
