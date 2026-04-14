/**
 * holdEscrow — called when a buyer creates (posts) a new mission.
 *
 * Flow:
 *   1. Validate buyer has sufficient wallet balance.
 *   2. Deduct  (itemPrice + deliveryFee)  from buyer's wallet.
 *   3. Create  escrow_hold  transaction record.
 *   4. Write the mission document with status = "Open".
 *
 * Idempotency:
 *   The missionId is generated client-side (nanoid / Firestore auto-id) and
 *   passed in. If the document already exists we return its id immediately,
 *   so a network retry never double-charges the buyer.
 */

import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { PLATFORM_FEE_RATE, MISSION_STATUS } from '../constants';

const db = admin.firestore();

interface HoldEscrowData {
  /** Pre-generated mission ID from the client (idempotency key). */
  missionId: string;
  title: string;
  description: string;
  itemPhotoUrl: string | null;
  marketplaceUrl: string | null;
  /** CAD cents */
  itemPrice: number;
  /** CAD cents */
  deliveryFee: number;
  pickupAddress: string;
  pickupCoords: { latitude: number; longitude: number };
  dropoffAddress: string;
  dropoffCoords: { latitude: number; longitude: number };
  pickupDeadlineIso: string;
  distanceKm: number;
}

export const holdEscrow = onCall(async (request) => {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in required.');
  }
  const buyerUid = request.auth.uid;
  const data = request.data as HoldEscrowData;

  // ── 2. Input validation ───────────────────────────────────────────────────
  if (!data.missionId || typeof data.missionId !== 'string') {
    throw new HttpsError('invalid-argument', 'missionId is required.');
  }
  if (!Number.isInteger(data.itemPrice) || data.itemPrice <= 0) {
    throw new HttpsError('invalid-argument', 'itemPrice must be a positive integer (CAD cents).');
  }
  if (!Number.isInteger(data.deliveryFee) || data.deliveryFee <= 0) {
    throw new HttpsError('invalid-argument', 'deliveryFee must be a positive integer (CAD cents).');
  }

  const platformFee  = Math.round(data.deliveryFee * PLATFORM_FEE_RATE);
  const heroEarning  = data.deliveryFee - platformFee;
  // Total locked from buyer: they cover both the item cost AND the delivery fee.
  const escrowAmount = data.itemPrice + data.deliveryFee;

  const missionRef   = db.collection('missions').doc(data.missionId);
  const buyerRef     = db.collection('users').doc(buyerUid);
  const escrowTxRef  = db.collection('transactions').doc();
  const now          = Timestamp.now();

  await db.runTransaction(async (tx) => {
    const [missionSnap, buyerSnap] = await Promise.all([
      tx.get(missionRef),
      tx.get(buyerRef),
    ]);

    // ── Idempotency: mission already created → no-op ──────────────────────
    if (missionSnap.exists) {
      return { missionId: data.missionId, alreadyExists: true };
    }

    // ── Insufficient funds check ───────────────────────────────────────────
    const walletBalance: number = buyerSnap.data()?.walletBalance ?? 0;
    if (walletBalance < escrowAmount) {
      throw new HttpsError(
        'failed-precondition',
        `Insufficient wallet balance. Need ${escrowAmount}¢, have ${walletBalance}¢.`,
      );
    }

    // ── Deduct escrow from buyer wallet ────────────────────────────────────
    tx.update(buyerRef, {
      walletBalance: FieldValue.increment(-escrowAmount),
    });

    // ── Record escrow_hold transaction ─────────────────────────────────────
    tx.set(escrowTxRef, {
      fromUid:   buyerUid,
      toUid:     null,          // held in platform escrow pool
      missionId: data.missionId,
      amount:    escrowAmount,
      currency:  'CAD',
      type:      'escrow_hold',
      status:    'settled',
      note:      `Escrow held for mission ${data.missionId}`,
      createdAt: now,
      settledAt: now,
    });

    // ── Create mission document ────────────────────────────────────────────
    tx.set(missionRef, {
      buyerId:         buyerUid,
      heroId:          null,
      title:           data.title,
      description:     data.description,
      itemPhotoUrl:    data.itemPhotoUrl ?? null,
      marketplaceUrl:  data.marketplaceUrl ?? null,
      itemPrice:       data.itemPrice,
      deliveryFee:     data.deliveryFee,
      platformFee,
      heroEarning,
      pickupAddress:   data.pickupAddress,
      pickupCoords:    new admin.firestore.GeoPoint(
                         data.pickupCoords.latitude,
                         data.pickupCoords.longitude,
                       ),
      dropoffAddress:  data.dropoffAddress,
      dropoffCoords:   new admin.firestore.GeoPoint(
                         data.dropoffCoords.latitude,
                         data.dropoffCoords.longitude,
                       ),
      pickupDeadline:  Timestamp.fromDate(new Date(data.pickupDeadlineIso)),
      distanceKm:      data.distanceKm,
      status:          MISSION_STATUS.OPEN,
      createdAt:       now,
      acceptedAt:      null,
      pickedUpAt:      null,
      deliveredAt:     null,
      completedAt:     null,
      cancelledAt:     null,
      pickupPhotoUrl:  null,
      deliveryPhotoUrl: null,
      escrowTxId:      escrowTxRef.id,
      payoutTxId:      null,
    });
  });

  return { missionId: data.missionId, escrowAmount, platformFee, heroEarning };
});
