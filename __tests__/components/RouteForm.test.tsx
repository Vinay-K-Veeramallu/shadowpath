import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { RouteForm } from "../../components/RouteForm";

describe("RouteForm unit tests", () => {
  it("renders origin, destination, time slider, access selector, and accessibility checkbox", () => {
    render(<RouteForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/^from$/i)).toBeTruthy();
    expect(screen.getByLabelText(/^to$/i)).toBeTruthy();
    expect(screen.getByRole("slider", { name: /time of day/i })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /access level/i })).toBeTruthy();
    expect(screen.getByLabelText(/wheelchair-accessible paths only/i)).toBeTruthy();
  });

  it("shows inline error and does not call onSubmit when origin is empty", async () => {
    const onSubmit = vi.fn();
    render(<RouteForm onSubmit={onSubmit} />);

    // Fill destination but leave origin empty
    await userEvent.type(screen.getByLabelText(/^to$/i), "Hayden Library");
    await userEvent.click(screen.getByRole("button", { name: /find routes/i }));

    expect(screen.getByText(/origin is required/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows inline error and does not call onSubmit when destination is empty", async () => {
    const onSubmit = vi.fn();
    render(<RouteForm onSubmit={onSubmit} />);

    // Fill origin but leave destination empty
    await userEvent.type(screen.getByLabelText(/^from$/i), "Memorial Union");
    await userEvent.click(screen.getByRole("button", { name: /find routes/i }));

    expect(screen.getByText(/destination is required/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
