"use client";
import type { RiskLevel } from "../../lib/planner/types";

interface DailySafetyBadgeProps {
  riskLevel: RiskLevel;
}

const config: Record<RiskLevel, { label: string; icon: string; classes: string }> = {
  "lower-risk": {
    label: "Lower-risk",
    icon: "✓",
    classes:
      "bg-green-100 hc:bg-white text-green-800 hc:text-black border border-green-300 hc:border-black",
  },
  "higher-risk": {
    label: "Higher-risk",
    icon: "⚠️",
    classes:
      "bg-amber-100 hc:bg-white text-amber-800 hc:text-black border border-amber-300 hc:border-black",
  },
  "not recommended": {
    label: "Not Recommended",
    icon: "⛔",
    classes:
      "bg-red-100 hc:bg-white text-red-800 hc:text-black border border-red-300 hc:border-black",
  },
};

export function DailySafetyBadge({ riskLevel }: DailySafetyBadgeProps) {
  const { label, icon, classes } = config[riskLevel];

  return (
    <span
      role="status"
      aria-label={`Daily risk level: ${label}`}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-semibold ${classes}`}
    >
      {icon} {label}
    </span>
  );
}
