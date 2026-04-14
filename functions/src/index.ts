/**
 * Firebase Cloud Functions entry point — On The Way Hero
 *
 * All functions use the Firebase Functions v2 SDK (2nd gen).
 * Admin SDK is initialised once here; individual modules import `db` from
 * firebase-admin directly (singleton pattern — safe to call initializeApp
 * multiple times in emulator; in production the first call wins).
 */

import * as admin from 'firebase-admin';

// Initialise Admin SDK (runs once at cold start)
admin.initializeApp();

// ─── Escrow Functions ─────────────────────────────────────────────────────────

export { holdEscrow }     from './escrow/holdEscrow';
export { completeMission } from './escrow/completeMission';
export { cancelMission }   from './escrow/cancelMission';
