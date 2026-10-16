// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CommentCard } from "./CommentCard";
import type { CommentPlan } from "./insights";

afterEach(cleanup);

const plan: CommentPlan = {
  text: "Em vững ở mức Nhận biết, còn hụt khi bài ở mức Thông hiểu.",
  action: { kind: "level", levelCode: "hieu", label: "Luyện 10 câu Thông hiểu →" },
};

describe("CommentCard", () => {
  it("renders the text and exactly one action button with the plan's label", () => {
    render(<CommentCard plan={plan} onAction={() => {}} pending={false} />);
    expect(screen.getByText(plan.text)).toBeTruthy();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toBe(plan.action.label);
  });

  it("calls onAction with the exact action object on click", () => {
    const onAction = vi.fn();
    render(<CommentCard plan={plan} onAction={onAction} pending={false} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(plan.action);
  });

  it("pending disables the button", () => {
    render(<CommentCard plan={plan} onAction={() => {}} pending={true} />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
