/**
 * completeMission — triggered when the buyer clicks "Confirm Receipt".
 *
 * Money flow on completion:
 *
 *   Escrow pool  ──►  Hero wallet   (itemPrice + 95% of deliveryFee)
 *   Escrow pool  ──►  Platform      (5% of deliveryFee)
 *
 * Idempotency guarantee:
 *   The mission document gains a `payoutTxId` field the moment funds are
 *   released. The entire release runs inside a Firestore transaction, so:
 *     • Concurrent calls collapse — only one transaction commits.
 *     • If the function crashes AFTER the transaction, re-calling returns
 *       the existing payoutTxId immediately (no second debit).
 *     • If it crashes BEFORE, no money moved and the caller can safely retry.
 *
 *         ┌─────────────────────────────────────────────────────────┐
 *         │               completeMission state machine             │
 *         │                                                         │
 *         │  status == "Delivered"  &  payoutTxId == null           │
 *         │         │                                               │
 *         │         ▼  (transaction commits)                        │
 *         │  status == "Completed"  &  payoutTxId == "<txId>"       │
 *         │         │                                               │
 *         │         ▼  (idempotent re-call)                         │
 *         │  returns existing payoutTxId, no second write           │
 *         └─────────────────────────────────────────────────────────┘
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  PLATFORM_UID,
  AUTO_CONFIRM_MS,
  MISSION_STATUS,
} from '../constants';

const db = admin.firestore();

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompleteMissionData {
  missionId: string;
}

interface CompleteMissionResult {
  /** True when the mission was already completed in a prior call. */
  alreadyCompleted: boolean;
  payoutTxId: string;
  /** CAD cents credited to the hero's wallet. */
  heroTotal: number;
  /** CAD cents taken as platform commission. */
  platformFee: number;
}

// ─── Helper — authorisation ───────────────────────────────────────────────────

function assertCanComplete(
  callerUid: string,
  isAdmin: boolean,
  mission: FirebaseFirestore.DocumentData,
): void {
  const isBuyer = callerUid === mission.buyerId;

  // Auto-confirm path: buyer delivered but didn't confirm within 48 h
  const deliveredAt: Timestamp | null = mission.deliveredAt ?? null;
  const isAutoConfirmWindow =
    deliveredAt !== null &&
    Date.now() - deliveredAt.toMillis() >= AUTO_CONFIRM_MS;

  if (!isBuyer && !isAdmin && !isAutoConfirmWindow) {
    throw new HttpsError(
      'permission-denied',
      'Only the buyer (or an admin) can confirm delivery.',
    );
  }
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const completeMission = onCall(
  {
    // Enforce App Check in production to prevent unauthenticated calls
    enforceAppCheck: false, // set true once App Check is configured
  },
  async (request): Promise<CompleteMissionResult> => {
    // ── 1. Authentication ─────────────────────────────────────────────────
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in.');
    }

    const callerUid = request.auth.uid;
    const isAdmin   = request.auth.token?.admin === true;
    const { missionId } = request.data as CompleteMissionData;

    if (!missionId || typeof missionId !== 'string') {
      throw new HttpsError('invalid-argument', 'missionId is required.');
    }

    // ── 2. Firestore transaction — atomic read-check-write ────────────────
    const result = await db.runTransaction(
      async (tx): Promise<CompleteMissionResult> => {

        // ── Read all documents we will touch ────────────────────────────
        const missionRef  = db.collection('missions').doc(missionId);
        const missionSnap = await tx.get(missionRef);

        if (!missionSnap.exists) {
          throw new HttpsError('not-found', `Mission ${missionId} not found.`);
        }

        const mission = missionSnap.data()!;

        // ── Idempotency gate (check BEFORE auth to keep it cheap) ────────
        //
        //  payoutTxId is written atomically with the status update.
        //  If it is already set, a previous transaction committed fully —
        //  return that result without touching any balances.
        if (mission.status === MISSION_STATUS.COMPLETED && mission.payoutTxId) {
          return {
            alreadyCompleted: true,
            payoutTxId:       mission.payoutTxId as string,
            heroTotal:        (mission.itemPrice as number) + (mission.heroEarning as number),
            platformFee:      mission.platformFee as number,
          };
        }

        // ── Status guard — only "Delivered" missions can be completed ────
        if (mission.status !== MISSION_STATUS.DELIVERED) {
          throw new HttpsError(
            'failed-precondition',
            `Expected status "Delivered", got "${mission.status}".`,
          );
        }

        if (!mission.heroId) {
          throw new HttpsError('failed-precondition', 'No hero assigned to this mission.');
        }

        // ── Authorization ────────────────────────────────────────────────
        assertCanComplete(callerUid, isAdmin, mission);

        // ── Read hero + platform wallets ─────────────────────────────────
        const heroRef     = db.collection('users').doc(mission.heroId as string);
        const platformRef = db.collection('users').doc(PLATFORM_UID);

        const [heroSnap, platformSnap] = await Promise.all([
          tx.get(heroRef),
          tx.get(platformRef),
        ]);

        if (!heroSnap.exists) {
          throw new HttpsError('not-found', `Hero user ${mission.heroId} not found.`);
        }

        // ── Compute final amounts ────────────────────────────────────────
        //
        //  itemPrice    — cash the hero advanced at pickup; fully reimbursed
        //  deliveryFee  — buyer's reward offer to the hero
        //  platformFee  — 5% of deliveryFee (pre-computed and stored on mission)
        //  heroEarning  — 95% of deliveryFee (pre-computed and stored)
        //  heroTotal    — what lands in the hero's wallet
        //
        const itemPrice:    number = mission.itemPrice;
        const deliveryFee:  number = mission.deliveryFee;
        const platformFee:  number = mission.platformFee;
        const heroEarning:  number = mission.heroEarning;
        const heroTotal:    number = itemPrice + heroEarning;

        // Sanity check: fee components must reconcile
        if (platformFee + heroEarning !== deliveryFee) {
          throw new HttpsError(
            'internal',
            'Fee components do not reconcile. Manual review required.',
          );
        }

        // ── Generate document references for new transaction records ─────
        const now             = Timestamp.now();
        const payoutTxRef     = db.collection('transactions').doc();
        const platformFeeTxRef = db.collection('transactions').doc();
        const payoutTxId      = payoutTxRef.id;

        // ── WRITE 1: escrow_release → hero ───────────────────────────────
        tx.set(payoutTxRef, {
          fromUid:   null,               // from escrow pool (no single owner)
          toUid:     mission.heroId,
          missionId,
          amount:    heroTotal,
          currency:  'CAD',
          type:      'escrow_release',
          status:    'settled',
          note:      `Mission ${missionId}: item reimbursement (${itemPrice}¢) + delivery earning (${heroEarning}¢)`,
          createdAt: now,
          settledAt: now,
        });

        // ── WRITE 2: platform_fee ────────────────────────────────────────
        tx.set(platformFeeTxRef, {
          fromUid:   null,
          toUid:     PLATFORM_UID,
          missionId,
          amount:    platformFee,
          currency:  'CAD',
          type:      'platform_fee',
          status:    'settled',
          note:      `5% commission on mission ${missionId} (deliveryFee: ${deliveryFee}¢)`,
          createdAt: now,
          settledAt: now,
        });

        // ── WRITE 3: credit hero wallet ──────────────────────────────────
        tx.update(heroRef, {
          walletBalance:     FieldValue.increment(heroTotal),
          completedMissions: FieldValue.increment(1),
        });

        // ── WRITE 4: credit platform wallet (create if first run) ────────
        if (platformSnap.exists) {
          tx.update(platformRef, {
            walletBalance: FieldValue.increment(platformFee),
          });
        } else {
          tx.set(platformRef, {
            walletBalance: platformFee,
            displayName:   'Platform',
            role:          'platform',
            createdAt:     now,
          });
        }

        // ── WRITE 5: seal mission — status + idempotency key ─────────────
        //
        //  payoutTxId written here is the idempotency key.
        //  Any re-entrant call will hit the gate above and return early.
        tx.update(missionRef, {
          status:      MISSION_STATUS.COMPLETED,
          completedAt: now,
          payoutTxId,           // ← idempotency anchor
        });

        return { alreadyCompleted: false, payoutTxId, heroTotal, platformFee };
      },
    );

    return result;
  },
);
