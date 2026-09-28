export type Input = { destination?: string; forward: number; turn: number; brake: boolean; targetPoint?: { x: number, z: number } | null };
export type Person = { station?: string | null; y?: number; id: string; name: string; color: string; x: number; z: number; yaw: number; vehicle: number | null; seat: number | null; interior: string | null; message: string; score: number; unlocked: string[] };
export type VehicleKind = 'car' | 'bike' | 'cycle';
export type CarState = { kind: VehicleKind; color: string; x: number; z: number; yaw: number; speed: number; owner: string | null; autopilot?: boolean };
export type Coin = { id: string; x: number; z: number; value: number };
export type Snapshot = { targetPoint?: Input['targetPoint']; serverTime?: number; self: string; players: Person[]; vehicles: CarState[]; coins: Coin[]; npcs?: Person[] };
