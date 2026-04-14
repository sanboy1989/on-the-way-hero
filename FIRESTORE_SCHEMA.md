# Firestore Schema — On The Way Hero

> UI language: **English**
> All field names use camelCase. Timestamps use Firestore `Timestamp` type.

---

## Collection: `users`

Document ID: `{uid}` (Firebase Auth UID)

```
users/
  {uid}/
    ├── profile
    ├── wallet
    ├── verification
    └── stats
```

### Full Document Structure

```ts
// users/{uid}
{
  // --- Identity ---
  uid:              string,          // mirrors Firebase Auth UID
  displayName:      string,          // e.g. "Jason C."
  email:            string,
  phoneNumber:      string | null,   // E.164 format: "+14031234567"
  avatarUrl:        string | null,   // Firebase Storage URL
  createdAt:        Timestamp,
  lastSeenAt:       Timestamp,

  // --- Role ---
  role:             "buyer" | "hero" | "both",  // a user can be both

  // --- Wallet (Escrow) ---
  walletBalance:    number,          // CAD cents (integer), e.g. 1050 = $10.50
  walletCurrency:   "CAD",

  // --- Verification ---
  isVerified:       boolean,         // true = "Verified Hero" badge granted
  verificationStatus: "unsubmitted" | "pending" | "approved" | "rejected",
  idPhotoUrl:       string | null,   // Firebase Storage (private bucket, admin-only read)
  idPhotoSubmittedAt: Timestamp | null,
  idPhotoReviewedAt:  Timestamp | null,
  idPhotoReviewedBy:  string | null, // admin uid or "system" (if 3rd-party API)
  verificationNote:   string | null, // rejection reason (shown to user)

  // --- Reputation ---
  ratingAvg:        number,          // 0.0–5.0
  ratingCount:      number,
  completedMissions: number,
}
```

### Sub-collection: `users/{uid}/notifications`

```ts
// users/{uid}/notifications/{notifId}
{
  type:      "mission_accepted" | "mission_delivered" | "payment_released" | "verification_approved" | "verification_rejected",
  message:   string,           // human-readable English
  missionId: string | null,
  isRead:    boolean,
  createdAt: Timestamp,
}
```

---

## Collection: `missions`

Document ID: auto-generated (`{missionId}`)

```
missions/
  {missionId}/
    └── offers/       ← hero bids (optional future feature)
```

### Full Document Structure

```ts
// missions/{missionId}
{
  // --- Ownership ---
  buyerId:          string,     // users/{uid}
  heroId:           string | null,  // assigned after pickup

  // --- Item Info ---
  title:            string,     // e.g. "IKEA KALLAX shelf (white)"
  description:      string,     // free text, item details
  itemPhotoUrl:     string | null,  // Firebase Storage URL
  marketplaceUrl:   string | null,  // Facebook Marketplace / Kijiji link

  // --- Pricing ---
  itemPrice:        number,     // CAD cents — hero pays this upfront at pickup
  deliveryFee:      number,     // CAD cents — buyer's offer to hero
  platformFee:      number,     // CAD cents — 5% of deliveryFee (computed on create)
  heroEarning:      number,     // CAD cents — deliveryFee - platformFee (computed)

  // --- Locations ---
  pickupAddress:    string,     // human-readable
  pickupCoords:     GeoPoint,   // Firestore GeoPoint {latitude, longitude}
  dropoffAddress:   string,
  dropoffCoords:    GeoPoint,

  // --- Scheduling ---
  pickupDeadline:   Timestamp,  // buyer's requested pickup window end
  distanceKm:       number,     // estimated route distance (from Maps API)

  // --- Status Machine ---
  //  Open → Accepted → PickedUp → Delivered → Completed
  //  Open → Cancelled  (by buyer, before Accepted)
  //  Accepted → Cancelled  (requires admin arbitration)
  //  Delivered → Disputed  (buyer raises issue)
  status: "Open" | "Accepted" | "PickedUp" | "Delivered" | "Completed" | "Cancelled" | "Disputed",

  // --- Timestamps per status ---
  createdAt:        Timestamp,
  acceptedAt:       Timestamp | null,
  pickedUpAt:       Timestamp | null,
  deliveredAt:      Timestamp | null,
  completedAt:      Timestamp | null,
  cancelledAt:      Timestamp | null,

  // --- Proof ---
  pickupPhotoUrl:   string | null,   // hero uploads on pickup
  deliveryPhotoUrl: string | null,   // hero uploads on delivery

  // --- Escrow ---
  escrowTxId:       string | null,   // ref to transactions/{txId} for the hold
  payoutTxId:       string | null,   // ref to transactions/{txId} for the release
}
```

### Status Flow Diagram

```
                ┌─────────┐
   buyer posts  │  Open   │
   ─────────── ▶│         │──── buyer cancels ──▶ Cancelled
                └────┬────┘
                     │ hero accepts
                     ▼
               ┌──────────┐
               │ Accepted │──── (arbitration needed) ──▶ Cancelled
               └────┬─────┘
                    │ hero picks up item + uploads photo
                    ▼
               ┌──────────┐
               │ PickedUp │
               └────┬─────┘
                    │ hero marks delivered + uploads photo
                    ▼
               ┌───────────┐
               │ Delivered │──── buyer disputes ──▶ Disputed
               └────┬──────┘
                    │ buyer confirms (or auto-confirm after 48h)
                    ▼
               ┌───────────┐
               │ Completed │  ← escrow released to hero
               └───────────┘
```

---

## Collection: `transactions`

Document ID: auto-generated (`{txId}`)

Tracks every money movement. Never mutated after creation (append-only).

```ts
// transactions/{txId}
{
  // --- Parties ---
  fromUid:    string | null,   // null = platform/escrow pool
  toUid:      string | null,   // null = platform/escrow pool
  missionId:  string | null,

  // --- Amount ---
  amount:     number,          // CAD cents, always positive
  currency:   "CAD",

  // --- Type ---
  type: "escrow_hold"       // buyer's funds locked when mission posted
       | "escrow_release"   // funds released to hero after Completed
       | "platform_fee"     // 5% commission deducted from hero payout
       | "refund"           // funds returned to buyer (Cancelled / Disputed)
       | "top_up"           // buyer adds funds to wallet (future: Stripe)
       | "withdrawal",      // hero withdraws to bank (future: Stripe Payout)

  // --- Audit ---
  status:    "pending" | "settled" | "failed",
  note:      string | null,    // human-readable description
  createdAt: Timestamp,
  settledAt: Timestamp | null,
}
```

### Example Transaction Sequence for a Completed Mission

```
1. buyer top_up        fromUid=null        toUid=buyerUid   $50.00
2. escrow_hold         fromUid=buyerUid    toUid=null       $25.00  ← mission posted
3. escrow_release      fromUid=null        toUid=heroUid    $23.75  ← 95% of deliveryFee
4. platform_fee        fromUid=null        toUid=platformUid $1.25  ← 5% of deliveryFee
```

---

## Firestore Security Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ──────────────────────────────────────────────────────────
    function isSignedIn() {
      return request.auth != null;
    }
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    function isAdmin() {
      return isSignedIn() && request.auth.token.admin == true;
    }
    function isVerifiedHero() {
      return isSignedIn() && request.auth.token.isVerified == true;
    }

    // ── users ─────────────────────────────────────────────────────────────
    match /users/{uid} {
      // Anyone signed in can read public profile fields
      allow read: if isSignedIn();

      // User can only write their own doc; admin can write anything
      allow create: if isOwner(uid);
      allow update: if isOwner(uid) && !affectsVerification()
                    || isAdmin();
      allow delete: if false; // soft-delete only via admin

      // Prevent self-granting verification
      function affectsVerification() {
        return request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(["isVerified", "verificationStatus", "idPhotoReviewedBy"]);
      }

      match /notifications/{notifId} {
        allow read, write: if isOwner(uid);
      }
    }

    // ── missions ──────────────────────────────────────────────────────────
    match /missions/{missionId} {
      // Anyone signed in can browse Open missions
      allow read: if isSignedIn();

      // Only buyers can create missions
      allow create: if isSignedIn()
                    && request.resource.data.buyerId == request.auth.uid
                    && request.resource.data.status == "Open";

      // Buyer can cancel their own Open mission
      // Verified Hero can accept Open missions
      // Participants can update status along the allowed flow
      allow update: if isSignedIn() && (
        isBuyerUpdate() || isHeroUpdate() || isAdmin()
      );

      allow delete: if false;

      function isBuyerUpdate() {
        return resource.data.buyerId == request.auth.uid;
      }
      function isHeroUpdate() {
        return isVerifiedHero()
          && (resource.data.heroId == request.auth.uid
              || resource.data.heroId == null);
      }
    }

    // ── transactions (append-only, admin + Functions only) ───────────────
    match /transactions/{txId} {
      allow read:   if isSignedIn()
                    && (resource.data.fromUid == request.auth.uid
                        || resource.data.toUid  == request.auth.uid
                        || isAdmin());
      allow create: if isAdmin(); // only Firebase Functions (admin SDK) writes these
      allow update, delete: if false;
    }
  }
}
```

---

## Verified Hero — Identity Verification Flow

### Overview

```
User submits ID photo
        │
        ▼
Firebase Storage (private)  ←── idPhotoUrl stored in users/{uid}
        │
        ▼
   [Review Path A]                    [Review Path B]
   Manual Admin Review          3rd-party KYC API (e.g. Persona)
   (admin dashboard)                  (webhook → Functions)
        │                                     │
        └──────────────┬──────────────────────┘
                       ▼
          Firebase Function: grantVerification()
                       │
          ┌────────────┴───────────────┐
          │  setCustomUserClaims()     │  ← Firebase Admin SDK
          │  { isVerified: true }      │
          └────────────┬───────────────┘
                       │
          Update users/{uid}:
          { isVerified: true,
            verificationStatus: "approved" }
                       │
          Send notification to user
                       │
                       ▼
             "Verified Hero" badge
             visible on profile + missions
```

### Option A — Manual Admin Review

1. User uploads government-issued ID photo via app
2. Photo stored in **private** Firebase Storage bucket (`gs://...private/ids/{uid}`)
3. Admin dashboard (Next.js `/admin` route, gated by `isAdmin` custom claim) shows queue
4. Admin approves/rejects → triggers Cloud Function `grantVerification`
5. Function calls `admin.auth().setCustomUserClaims(uid, { isVerified: true })`
6. User's ID token is refreshed on next request; `isVerifiedHero()` rule becomes `true`

### Option B — Persona KYC API (recommended for scale)

```
App → Persona Inquiry → webhook POST → /api/webhook/persona
                                             │
                                    Firebase Function
                                    verifies webhook signature
                                             │
                              inquiry.status == "approved"?
                                        │
                               grantVerification(uid)
```

- [Persona](https://withpersona.com/) offers a free tier and a pre-built verification flow
- Webhook payload includes `uid` (passed as reference ID when creating inquiry)
- No manual review needed; result arrives within seconds

### Custom Claim vs. Firestore Field — Why Both?

| | Custom Claim (`isVerified`) | Firestore field (`isVerified`) |
|---|---|---|
| Used by | Security Rules, server-side checks | UI badge display |
| Propagation | JWT (refreshed every hour) | Real-time |
| Writable by | Admin SDK (Functions) only | Admin SDK only |

The custom claim is the **authoritative gate**; the Firestore field is the **UI mirror**.

---

## Index Recommendations

```
# firestore.indexes.json
missions: status ASC, createdAt DESC        ← Open mission feed
missions: buyerId ASC, createdAt DESC       ← buyer's mission history
missions: heroId ASC, status ASC            ← hero's active missions
transactions: fromUid ASC, createdAt DESC   ← wallet history
transactions: toUid ASC, createdAt DESC     ← wallet history
```
