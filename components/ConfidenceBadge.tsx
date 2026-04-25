"use client";
import type { ConfidenceLabel } from "../lib/routing/types";

interface ConfidenceBadgeProps {
  confidence: ConfidenceLabel;
}

const styles: Record<ConfidenceLabel, string> = {
  High: "bg-green-100 text-green-800 border-green-300",
  Medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Low: "bg-red-100 text-red-800 border-red-300",
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles[confidence]}`}
      aria-label={`Confidence: ${confidence}`}
    >
      {confidence}
    </span>
  );
}
