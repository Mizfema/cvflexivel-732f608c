import posthog from "posthog-js";

export const EVENT_NAMES = [
  "cv_created",
  "cv_downloaded",
  "ai_used",
  "template_selected",
  "signup",
  "login",
  "limit_hit",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export function track(event: EventName, props?: Record<string, unknown>) {
  posthog.capture(event, props);
}

export function identifyUser(userId: string) {
  posthog.identify(userId);
}

export function resetAnalytics() {
  posthog.reset();
}
