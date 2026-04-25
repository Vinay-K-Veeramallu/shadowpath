/**
 * DayPlannerForm component tests
 * Validates: Requirements 1.1, 1.3, 1.4, 1.5
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { DayPlannerForm } from "../../components/planner/DayPlannerForm";
import type { PersonalHeatMode } from "../../lib/planner/types";

const TEST_PREFERENCES: PersonalHeatMode = {
  standardWalking: true,
  lowExertion: false,
  wheelchairAccessible: false,
  asthmaSensitive: false,
  preferShadedPaths: false,
  preferWaterRefillStops: false,
  preferCoolingStops: false,
  preferShuttleAlternatives: false,
};

describe("DayPlannerForm", () => {
  /** Validates: Requirement 1.1 — Form renders all input fields */
  it("renders all input fields for each default commitment", () => {
    render(<DayPlannerForm onSubmit={vi.fn()} preferences={TEST_PREFERENCES} />);

    // Should render 2 commitments by default
    // Each commitment has: location, start time, end time, label, flexibility toggle
    expect(screen.getByLabelText("Location", { selector: "#location-0" })).toBeTruthy();
    expect(screen.getByLabelText("Location", { selector: "#location-1" })).toBeTruthy();
    expect(screen.getByLabelText("Start Time", { selector: "#start-time-0" })).toBeTruthy();
    expect(screen.getByLabelText("Start Time", { selector: "#start-time-1" })).toBeTruthy();
    expect(screen.getByLabelText("End Time (optional)", { selector: "#end-time-0" })).toBeTruthy();
    expect(screen.getByLabelText("End Time (optional)", { selector: "#end-time-1" })).toBeTruthy();
    expect(screen.getByLabelText("Label", { selector: "#label-0" })).toBeTruthy();
    expect(screen.getByLabelText("Label", { selector: "#label-1" })).toBeTruthy();

    // Flexibility toggles
    expect(screen.getByLabelText("Flexible timing", { selector: "#flexibility-0" })).toBeTruthy();
    expect(screen.getByLabelText("Flexible timing", { selector: "#flexibility-1" })).toBeTruthy();

    // Action buttons
    expect(screen.getByRole("button", { name: /load demo schedule/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /add commitment/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /plan my day/i })).toBeTruthy();
  });

  /** Validates: Requirement 1.3 — Demo schedule loads 4 commitments */
  it("loads 4 commitments when Load Demo Schedule is clicked", async () => {
    const user = userEvent.setup();
    render(<DayPlannerForm onSubmit={vi.fn()} preferences={TEST_PREFERENCES} />);

    await user.click(screen.getByRole("button", { name: /load demo schedule/i }));

    // After loading demo, should have 4 location dropdowns
    expect(screen.getByLabelText("Location", { selector: "#location-0" })).toBeTruthy();
    expect(screen.getByLabelText("Location", { selector: "#location-1" })).toBeTruthy();
    expect(screen.getByLabelText("Location", { selector: "#location-2" })).toBeTruthy();
    expect(screen.getByLabelText("Location", { selector: "#location-3" })).toBeTruthy();

    // Verify the demo schedule values are populated
    // Demo: b3 (Coor Hall), b4 (W.P. Carey), b2 (Memorial Union), b1 (Hayden Library)
    const loc0 = screen.getByLabelText("Location", { selector: "#location-0" }) as HTMLSelectElement;
    const loc1 = screen.getByLabelText("Location", { selector: "#location-1" }) as HTMLSelectElement;
    const loc2 = screen.getByLabelText("Location", { selector: "#location-2" }) as HTMLSelectElement;
    const loc3 = screen.getByLabelText("Location", { selector: "#location-3" }) as HTMLSelectElement;
    expect(loc0.value).toBe("b3");
    expect(loc1.value).toBe("b4");
    expect(loc2.value).toBe("b2");
    expect(loc3.value).toBe("b1");

    // Verify start times
    const time0 = screen.getByLabelText("Start Time", { selector: "#start-time-0" }) as HTMLInputElement;
    const time1 = screen.getByLabelText("Start Time", { selector: "#start-time-1" }) as HTMLInputElement;
    const time2 = screen.getByLabelText("Start Time", { selector: "#start-time-2" }) as HTMLInputElement;
    const time3 = screen.getByLabelText("Start Time", { selector: "#start-time-3" }) as HTMLInputElement;
    expect(time0.value).toBe("10:30");
    expect(time1.value).toBe("12:00");
    expect(time2.value).toBe("14:00");
    expect(time3.value).toBe("16:30");
  });

  /** Validates: Requirement 1.4 — Validation error for empty location */
  it("shows validation error when submitting with empty location fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DayPlannerForm onSubmit={onSubmit} preferences={TEST_PREFERENCES} />);

    await user.click(screen.getByRole("button", { name: /plan my day/i }));

    // Should show validation error for empty location
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/please select a location/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /** Validates: Requirement 1.5 — Max 5 commitments enforced */
  it("does not allow adding more than 5 commitments", async () => {
    const user = userEvent.setup();
    render(<DayPlannerForm onSubmit={vi.fn()} preferences={TEST_PREFERENCES} />);

    // Start with 2, add 3 more to reach 5
    const addBtn = screen.getByRole("button", { name: /add commitment/i });
    await user.click(addBtn);
    await user.click(addBtn);
    await user.click(addBtn);

    // Should now have 5 commitments
    expect(screen.getByLabelText("Location", { selector: "#location-4" })).toBeTruthy();

    // Add Commitment button should no longer be visible at 5
    expect(screen.queryByRole("button", { name: /add commitment/i })).toBeNull();
  });

  /** Validates: Requirement 1.4 — Min 2 commitments enforced (Remove buttons hidden at 2) */
  it("does not show Remove buttons when only 2 commitments exist", () => {
    render(<DayPlannerForm onSubmit={vi.fn()} preferences={TEST_PREFERENCES} />);

    // With exactly 2 commitments, no Remove buttons should be visible
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
  });

  /** Validates: Requirement 1.4 — Remove buttons appear with >2 commitments */
  it("shows Remove buttons when more than 2 commitments exist", async () => {
    const user = userEvent.setup();
    render(<DayPlannerForm onSubmit={vi.fn()} preferences={TEST_PREFERENCES} />);

    await user.click(screen.getByRole("button", { name: /add commitment/i }));

    // With 3 commitments, Remove buttons should appear
    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    expect(removeButtons.length).toBe(3);
  });

  /** Validates: Requirement 1.4 — Validation error for empty start time */
  it("shows validation error when submitting with empty start time", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DayPlannerForm onSubmit={onSubmit} preferences={TEST_PREFERENCES} />);

    // Load demo to get locations filled, then clear a start time
    await user.click(screen.getByRole("button", { name: /load demo schedule/i }));

    // Clear the first start time
    const time0 = screen.getByLabelText("Start Time", { selector: "#start-time-0" }) as HTMLInputElement;
    await user.clear(time0);

    await user.click(screen.getByRole("button", { name: /plan my day/i }));

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/please enter a start time/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  /** Validates: Requirement 1.1 — Successful submission calls onSubmit */
  it("calls onSubmit with commitments when form is valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<DayPlannerForm onSubmit={onSubmit} preferences={TEST_PREFERENCES} />);

    // Load demo schedule (all fields pre-filled)
    await user.click(screen.getByRole("button", { name: /load demo schedule/i }));
    await user.click(screen.getByRole("button", { name: /plan my day/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [commitments, preferences] = onSubmit.mock.calls[0];
    expect(commitments).toHaveLength(4);
    expect(commitments[0].location).toBe("b3");
    expect(preferences).toBeDefined();
  });

  it("passes the preferences prop through to onSubmit (sidebar heat mode)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const prefs = { ...TEST_PREFERENCES, preferShadedPaths: true, wheelchairAccessible: true };
    render(<DayPlannerForm onSubmit={onSubmit} preferences={prefs} />);

    await user.click(screen.getByRole("button", { name: /load demo schedule/i }));
    await user.click(screen.getByRole("button", { name: /plan my day/i }));

    const [, submittedPrefs] = onSubmit.mock.calls[0];
    expect(submittedPrefs.preferShadedPaths).toBe(true);
    expect(submittedPrefs.wheelchairAccessible).toBe(true);
  });
});
