import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ShadeSlider } from "../../components/ShadeSlider";

describe("ShadeSlider unit tests", () => {
  it("ArrowRight advances to the next slot", async () => {
    const onChange = vi.fn();
    render(<ShadeSlider value={10} onChange={onChange} />);

    const slider = screen.getByRole("slider", { name: /time of day/i });
    await userEvent.type(slider, "{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("ArrowLeft moves to the previous slot", async () => {
    const onChange = vi.fn();
    render(<ShadeSlider value={14} onChange={onChange} />);

    const slider = screen.getByRole("slider", { name: /time of day/i });
    await userEvent.type(slider, "{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("ArrowRight at last slot wraps to first", async () => {
    const onChange = vi.fn();
    render(<ShadeSlider value={20} onChange={onChange} />);

    const slider = screen.getByRole("slider", { name: /time of day/i });
    await userEvent.type(slider, "{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith(6);
  });
});
