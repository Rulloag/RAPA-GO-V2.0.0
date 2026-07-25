import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppleSignInButton } from "../AppleSignInButton.js";

describe("AppleSignInButton", () => {
  it("is visible when isAvailable is true (iOS)", () => {
    render(<AppleSignInButton isAvailable loading={false} onPress={() => {}} />);
    expect(screen.getByTestId("apple-sign-in-button")).toBeInTheDocument();
    expect(screen.getByText("Sign in with Apple")).toBeInTheDocument();
  });

  it("is hidden (renders nothing) when isAvailable is false — covers both Android and Web", () => {
    const { container } = render(<AppleSignInButton isAvailable={false} loading={false} onPress={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onPress when clicked", () => {
    const onPress = vi.fn();
    render(<AppleSignInButton isAvailable loading={false} onPress={onPress} />);
    fireEvent.click(screen.getByTestId("apple-sign-in-button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("is disabled while loading, preventing a double click", () => {
    render(<AppleSignInButton isAvailable loading disabled={false} onPress={() => {}} />);
    const button = screen.getByTestId("apple-sign-in-button");
    expect(button).toHaveAttribute("disabled");
  });

  it("is disabled when the parent screen has its own loading state (email/password submit in flight)", () => {
    render(<AppleSignInButton isAvailable loading={false} disabled onPress={() => {}} />);
    expect(screen.getByTestId("apple-sign-in-button")).toHaveAttribute("disabled");
  });

  it("always shows the official English label text, never a translated one", () => {
    render(<AppleSignInButton isAvailable loading={false} onPress={() => {}} />);
    expect(screen.getByText("Sign in with Apple")).toBeInTheDocument();
    expect(screen.queryByText(/iniciar sesión con apple/i)).not.toBeInTheDocument();
  });
});
