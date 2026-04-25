"use client";
import { useState } from "react";
import campusData from "../../data/campus.geojson";
import type { CampusCommitment, PersonalHeatMode } from "../../lib/planner/types";

interface DayPlannerFormProps {
  onSubmit: (commitments: CampusCommitment[], preferences: PersonalHeatMode) => void;
  disabled?: boolean;
  /** Current personal heat preferences (sidebar panel); submitted with the schedule. */
  preferences: PersonalHeatMode;
}

const buildings = (campusData as GeoJSON.FeatureCollection).features
  .filter((f) => f.properties?.type === "building")
  .map((f) => ({ id: f.properties!.id as string, name: f.properties!.name as string }));

const DEMO_SCHEDULE: CampusCommitment[] = [
  { location: "b3", startTime: "10:30", flexibility: "fixed", label: "Coor Hall" },
  { location: "b4", startTime: "12:00", flexibility: "fixed", label: "W.P. Carey" },
  { location: "b2", startTime: "14:00", flexibility: "flexible", label: "Memorial Union" },
  { location: "b1", startTime: "16:30", flexibility: "fixed", label: "Hayden Library" },
];

function emptyCommitment(): CampusCommitment {
  return { location: "", startTime: "", flexibility: "fixed", label: "" };
}

export function DayPlannerForm({ onSubmit, disabled = false, preferences }: DayPlannerFormProps) {
  const [commitments, setCommitments] = useState<CampusCommitment[]>([
    emptyCommitment(),
    emptyCommitment(),
  ]);
  const [error, setError] = useState<string | null>(null);

  function updateCommitment(index: number, patch: Partial<CampusCommitment>) {
    setCommitments((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCommitment() {
    if (commitments.length >= 5) return;
    setCommitments((prev) => [...prev, emptyCommitment()]);
    setError(null);
  }

  function removeCommitment(index: number) {
    if (commitments.length <= 2) return;
    setCommitments((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  }

  function loadDemo() {
    setCommitments(DEMO_SCHEDULE.map((c) => ({ ...c })));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (commitments.length < 2) {
      setError("At least 2 commitments are required.");
      return;
    }
    if (commitments.length > 5) {
      setError("Maximum of 5 commitments allowed.");
      return;
    }
    for (let i = 0; i < commitments.length; i++) {
      if (!commitments[i].location) {
        setError(`Commitment ${i + 1}: Please select a location.`);
        return;
      }
      if (!commitments[i].startTime) {
        setError(`Commitment ${i + 1}: Please enter a start time.`);
        return;
      }
    }
    setError(null);
    onSubmit(commitments, preferences);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <fieldset disabled={disabled} className="contents">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Campus Commitments</h2>
          <button
            type="button"
            onClick={loadDemo}
            className="text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          >
            Load Demo Schedule
          </button>
        </div>

        {error && (
          <p role="alert" className="text-red-600 text-sm font-medium">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-4">
          {commitments.map((commitment, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 flex flex-col gap-3 bg-white"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">
                  Commitment {index + 1}
                </span>
                {commitments.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeCommitment(index)}
                    className="text-sm text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-2 py-1"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`location-${index}`}
                    className="text-sm font-medium"
                  >
                    Location
                  </label>
                  <select
                    id={`location-${index}`}
                    value={commitment.location}
                    onChange={(e) =>
                      updateCommitment(index, { location: e.target.value })
                    }
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a building</option>
                    {buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`start-time-${index}`}
                    className="text-sm font-medium"
                  >
                    Start Time
                  </label>
                  <input
                    id={`start-time-${index}`}
                    type="time"
                    value={commitment.startTime}
                    onChange={(e) =>
                      updateCommitment(index, { startTime: e.target.value })
                    }
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`end-time-${index}`}
                    className="text-sm font-medium"
                  >
                    End Time (optional)
                  </label>
                  <input
                    id={`end-time-${index}`}
                    type="time"
                    value={commitment.endTime ?? ""}
                    onChange={(e) =>
                      updateCommitment(index, {
                        endTime: e.target.value || undefined,
                      })
                    }
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`label-${index}`}
                    className="text-sm font-medium"
                  >
                    Label
                  </label>
                  <input
                    id={`label-${index}`}
                    type="text"
                    value={commitment.label}
                    onChange={(e) =>
                      updateCommitment(index, { label: e.target.value })
                    }
                    placeholder="e.g. CS 101 Lecture"
                    className="border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id={`flexibility-${index}`}
                  type="checkbox"
                  checked={commitment.flexibility === "flexible"}
                  onChange={(e) =>
                    updateCommitment(index, {
                      flexibility: e.target.checked ? "flexible" : "fixed",
                    })
                  }
                  className="h-4 w-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                />
                <label
                  htmlFor={`flexibility-${index}`}
                  className="text-sm font-medium"
                >
                  Flexible timing
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          {commitments.length < 5 && (
            <button
              type="button"
              onClick={addCommitment}
              className="border border-blue-600 text-blue-600 rounded px-4 py-2 text-sm font-medium hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Add Commitment
            </button>
          )}
          <button
            type="submit"
            className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Plan My Day
          </button>
        </div>
      </fieldset>
    </form>
  );
}
