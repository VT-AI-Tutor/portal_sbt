/**
 * Shared test helper for instant-grading players (FillBlankPlayer, ClozePlayer, ...).
 *
 * React tracks controlled-input values on the DOM node itself, so a plain
 * `input.value = x` assignment is invisible to its change detection — the
 * native setter must be used to bypass that tracker (same pattern already
 * used in text.test.tsx). Likewise React's onBlur listens for the
 * (bubbling) "focusout" event, not the native "blur" event, which does not
 * bubble.
 */
import { act } from "react";

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  "value",
)!.set!;
const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype,
  "value",
)!.set!;

export function typeBlur(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  // Multiline blanks (#444) render a <textarea>, whose value setter lives on a
  // different prototype — pick the right native setter by tag.
  const setter = input.tagName === "TEXTAREA" ? nativeTextareaValueSetter : nativeInputValueSetter;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => input.dispatchEvent(new Event("focusout", { bubbles: true })));
}
