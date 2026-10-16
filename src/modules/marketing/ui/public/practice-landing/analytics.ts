/** Sự kiện phễu landing (spec §8) — fire-and-forget, không chặn UI, không throw. */
export type LandingEvent =
  | "landing_view"
  | "demo_start"
  | "demo_complete"
  | "trial_start"
  | "trial_complete"
  | "signup_from_landing";

export function trackLandingEvent(
  event: LandingEvent,
  params?: Record<string, string | number>,
): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function")
    return;
  window.gtag("event", event, params);
}
