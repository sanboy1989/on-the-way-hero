// ─── Shared constants for all Cloud Functions ────────────────────────────────

/** Platform commission rate applied to deliveryFee. */
export const PLATFORM_FEE_RATE = 0.05;

/**
 * Special Firestore UID that represents the platform's own wallet.
 * This document lives at users/platform and holds accumulated fees.
 */
export const PLATFORM_UID = 'platform';

/**
 * After this window elapses with no buyer action, the mission is
 * auto-confirmed and the escrow is released to the hero automatically.
 */
export const AUTO_CONFIRM_MS = 48 * 60 * 60 * 1_000; // 48 hours

/** Valid mission statuses in order of the happy path. */
export const MISSION_STATUS = {
  OPEN:      'Open',
  ACCEPTED:  'Accepted',
  PICKED_UP: 'PickedUp',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED:  'Disputed',
} as const;

export type MissionStatus = typeof MISSION_STATUS[keyof typeof MISSION_STATUS];
