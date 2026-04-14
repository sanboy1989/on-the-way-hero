// Mirrors Firestore schema defined in FIRESTORE_SCHEMA.md

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export type MissionStatus =
  | 'Open'
  | 'Accepted'
  | 'PickedUp'
  | 'Delivered'
  | 'Completed'
  | 'Cancelled'
  | 'Disputed';

export interface Mission {
  id: string;
  buyerId: string;
  heroId: string | null;

  title: string;
  description: string;
  itemPhotoUrl: string | null;
  marketplaceUrl: string | null;

  // All monetary values in CAD cents (integer)
  itemPrice: number;
  deliveryFee: number;
  platformFee: number;  // 5% of deliveryFee, computed on create
  heroEarning: number;  // deliveryFee - platformFee

  pickupAddress: string;
  pickupCoords: GeoPoint;
  dropoffAddress: string;
  dropoffCoords: GeoPoint;

  pickupDeadline:       Date;
  expectedDeliveryTime: Date | null;
  distanceKm: number;

  status: MissionStatus;
  createdAt: Date;
}
