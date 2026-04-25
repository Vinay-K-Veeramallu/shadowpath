"use client";
import type { SafetyVerdict } from "../lib/routing/types";

interface HeatSafetyBadgeProps {
  verdict: SafetyVerdict;
}

export function HeatSafetyBadge({ verdict }: HeatSafetyBadgeProps) {
  const label =
    verdict === "not-recommended"
      ? "Not recommended"
      : verdict === "higher-risk"
        ? "Higher risk"
        : "Lower risk";

  const aria =
    verdict === "not-recommended"
      ? "Heat safety: Not recommended (UTCI)"
      : verdict === "higher-risk"
        ? "Heat safety: Higher risk (UTCI)"
        : "Heat safety: Lower risk (UTCI)";

  const styles =
    verdict === "not-recommended"
      ? "bg-red-100 hc:bg-white text-red-800 hc:text-black border border-red-300 hc:border-black"
      : verdict === "higher-risk"
        ? "bg-orange-100 hc:bg-white text-orange-900 hc:text-black border border-orange-300 hc:border-black"
        : "bg-green-100 hc:bg-white text-green-800 hc:text-black border border-green-300 hc:border-black";

  const icon = verdict === "not-recommended" ? "⚠️" : verdict === "higher-risk" ? "◆" : "✓";

  return (
    <span
      role="status"
      aria-label={aria}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-semibold ${styles}`}
    >
      {icon} {label}
    </span>
  );
}
