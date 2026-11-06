import type { LatLngTuple } from './polyline';

export type KrlLineId = 'bogor' | 'cikarang' | 'rangkasbitung' | 'tangerang' | 'tanjung_priok' | 'airport' | 'merak';

export interface KrlLineMeta {
  id: KrlLineId;
  name: string;
  /** Line colour, matched to the KAI Commuter route map. */
  color: string;
  /** OpenStreetMap route relations whose track ways make up this line (used by scripts/fetch-krl-lines.ts). */
  osmRelationIds: number[];
}

export interface KrlLineGeometry {
  id: KrlLineId;
  /** One polyline per OSM track way, simplified. */
  paths: LatLngTuple[][];
}

export const KRL_LINES: KrlLineMeta[] = [
  { id: 'bogor', name: 'Bogor Line', color: '#E30A16', osmRelationIds: [16877210, 16877211] },
  { id: 'cikarang', name: 'Cikarang Line', color: '#0099D8', osmRelationIds: [2922163, 15094545] },
  { id: 'rangkasbitung', name: 'Rangkasbitung Line', color: '#8CC63F', osmRelationIds: [2922215] },
  { id: 'tangerang', name: 'Tangerang Line', color: '#B5651D', osmRelationIds: [2922235] },
  { id: 'tanjung_priok', name: 'Tanjung Priok Line', color: '#E5559A', osmRelationIds: [2922237] },
  { id: 'airport', name: 'Airport Line', color: '#2E2F70', osmRelationIds: [17675694] },
  { id: 'merak', name: 'Merak Line', color: '#24824D', osmRelationIds: [17862248] },
];
