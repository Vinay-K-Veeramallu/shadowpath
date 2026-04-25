"use client";
import { useHighContrast } from "../hooks/useHighContrast";

export function HighContrastToggle() {
  const { highContrast, toggleHighContrast } = useHighContrast();

  return (
    <button
      type="button"
      onClick={toggleHighContrast}
      className="px-3 py-1 rounded border border-current text-sm font-medium text-gray-700 hc:text-black hc:bg-white hc:border-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 hc:focus:ring-black"
      aria-pressed={highContrast}
    >
      High Contrast: {highContrast ? "On" : "Off"}
    </button>
  );
}
