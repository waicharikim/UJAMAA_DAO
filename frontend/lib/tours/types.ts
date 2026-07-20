// Shared types for the contextual tour system.
// Tour *content* (what each step says + which element it points at) lives in the
// frontend — selectors are a UI concern. The backend only tracks completion.

export interface TourStep {
  /** CSS selector for the element to spotlight, e.g. '[data-tour="create-proposal"]'. */
  element: string
  title: string
  description: string
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  /** Optional "go deeper" link into the Education library for this concept. */
  learnMore?: { href: string; label?: string }
}

export interface TourDefinition {
  /** Must match a seeded OnboardingTutorial key (category TOUR) for completion tracking. */
  key: string
  /** Human label for the on-demand "Take the tour" affordance. */
  label: string
  steps: TourStep[]
}
