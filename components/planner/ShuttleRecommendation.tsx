"use client";

import type { ShuttleAlternative } from "../../lib/planner/types";

interface ShuttleRecommendationProps {
  shuttle: ShuttleAlternative;
}

export function ShuttleRecommendation({ shuttle }: ShuttleRecommendationProps) {
  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex flex-col gap-2"
      role="region"
      aria-label={`Shuttle recommendation: ${shuttle.shuttleStopName}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">🚌</span>
        <h3 className="text-sm font-semibold text-blue-800">
          Shuttle Alternative
        </h3>
        {shuttle.accessible && (
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 border border-blue-300"
            aria-label="Wheelchair accessible"
          >
            ♿ Accessible
          </span>
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-blue-600">Stop</dt>
          <dd className="font-medium text-blue-900">{shuttle.shuttleStopName}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-blue-600">Est. Wait</dt>
          <dd className="font-medium text-blue-900">{shuttle.estimatedWaitMinutes} min</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-blue-600">Walking Distance</dt>
          <dd className="font-medium text-blue-900">{shuttle.walkingDistanceMeters} m</dd>
        </div>
      </dl>
    </div>
  );
}
