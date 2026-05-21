import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FoundationStatus } from "./FoundationStatus";

describe("FoundationStatus", () => {
  it("renders the LaunchPad foundation status with an accessible heading", () => {
    render(<FoundationStatus />);

    expect(
      screen.getByRole("heading", {
        name: /application scaffold is ready for launchpad stories/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/next\.js app router/i)).toBeInTheDocument();
  });
});
