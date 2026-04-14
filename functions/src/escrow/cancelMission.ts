/**
 * cancelMission — refunds the buyer's escrow when a mission is cancelled.
 *
 * Allowed cancellation windows:
 *   • Buyer can cancel any time while status == "Open"  (no arbitration needed)
 *   • Admin can cancel any status except "Completed"
 *   • "Accepted" / "PickedUp" cancellations require admin — they may involve
 *     a partial hero compensation (out of scope here; flagged as "Disputed").
 *
 * Idempotency:
 *   Same pattern as completeMission — check for existing refundTxId before
 *   any writes. The Firestore transaction ensures exactly-once execution.
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { MISSION_STATUS } from '../constants';

const db = admin.firestore();

interface CancelMissionData {
  missionId: string;
  /** Optional human-readable reason stored on the mission for audit. */
  reason?: string;
}

export const cancelMission = onCall(async (request) => {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }

  const callerUid = request.auth.uid;
  const isAdmin   = request.auth.token?.admin === true;
  const { missionId, reason } = request.data as CancelMissionData;

  if (!missionId || typeof missionId !== 'string') {
    throw new HttpsError('invalid-argument', 'missionId is required.');
  }

  // ── 2. Transaction ────────────────────────────────────────────────────────
  const result = await db.runTransaction(async (tx) => {
    const missionRef  = db.collection('missions').doc(missionId);
    const missionSnap = await tx.get(missionRef);

    if (!missionSnap.exists) {
      throw new HttpsError('not-found', `Mission ${missionId} not found.`);
    }

    const mission = missionSnap.data()!;

    // ── Idempotency gate ─────────────────────────────────────────────────
    if (mission.status === MISSION_STATUS.CANCELLED && mission.refundTxId) {
      return { alreadyRefunded: true, refundTxId: mission.refundTxId as string };
    }

    // ── Guard: cannot cancel completed missions ───────────────────────────
    if (mission.status === MISSION_STATUS.COMPLETED) {
      throw new HttpsError('failed-precondition', 'Completed missions cannot be cancelled.');
    }

    // ── Authorization logic ───────────────────────────────────────────────
    const isBuyer = callerUid === mission.buyerId;

    if (mission.status === MISSION_STATUS.OPEN) {
      // Buyer can self-serve cancel Open missions
      if (!isBuyer && !isAdmin) {
        throw new HttpsError('permission-denied', 'Only the buyer can cancel an open mission.');
      }
    } else {
      // Accepted/PickedUp/Delivered: admin arbitration required
      if (!isAdmin) {
        throw new HttpsError(
          'permission-denied',
          `Cancelling a "${mission.status}" mission requires admin review.`,
        );
      }
    }

    // ── Compute refund amount ─────────────────────────────────────────────
    // Full refund: buyer gets back itemPrice + deliveryFee (the escrow_hold amount)
    const refundAmount: number = (mission.itemPrice as number) + (mission.deliveryFee as number);

    // ── Refs ──────────────────────────────────────────────────────────────
    const buyerRef   = db.collection('users').doc(mission.buyerId as string);
    const refundTxRef = db.collection('transactions').doc();
    const now        = Timestamp.now();

    // ── WRITE 1: refund transaction ───────────────────────────────────────
    tx.set(refundTxRef, {
      fromUid:   null,             // from escrow pool
      toUid:     mission.buyerId,
      missionId,
      amount:    refundAmount,
      currency:  'CAD',
      type:      'refund',
      status:    'settled',
      note:      reason
                   ? `Cancelled mission ${missionId}: ${reason}`
                   : `Cancelled mission ${missionId}`,
      createdAt: now,
      settledAt: now,
    });

    // ── WRITE 2: return funds to buyer wallet ─────────────────────────────
    tx.update(buyerRef, {
      walletBalance: FieldValue.increment(refundAmount),
    });

    // ── WRITE 3: seal mission with idempotency key ────────────────────────
    tx.update(missionRef, {
      status:      MISSION_STATUS.CANCELLED,
      cancelledAt: now,
      refundTxId:  refundTxRef.id,   // ← idempotency anchor
      cancelReason: reason ?? null,
    });

    return { alreadyRefunded: false, refundTxId: refundTxRef.id, refundAmount };
  });

  return result;
});
