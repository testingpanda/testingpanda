/** Extractions below this confidence are always routed to mandatory user review. */
export const CONFIDENCE_REVIEW_THRESHOLD = 0.75;

/** Item statuses that represent the user having made an explicit decision. */
export const RESOLVED_ITEM_STATUSES = ["confirmed", "edited_confirmed", "rejected", "not_applicable", "missing"] as const;

/** Item statuses that still require a user decision before finalization. */
export const UNRESOLVED_ITEM_STATUSES = ["extracted", "needs_review", "unresolved"] as const;
