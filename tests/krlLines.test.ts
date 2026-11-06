import { roundPolyline, simplifyPolyline, type LatLngTuple } from '@/lib/map/polyline';
import { getKrlLineLayers } from '@/lib/map/krlGeometry';
import { KRL_LINES } from '@/lib/map/krlLines';

describe('simplifyPolyline', () => {
  it('drops points that lie on a straight segment', () => {
    const line: LatLngTuple[] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ];
    expect(simplifyPolyline(line, 0.0001)).toEqual([
      [0, 0],
      [0, 3],
    ]);
  });

  it('keeps a corner that deviates more than the tolerance', () => {
    const line: LatLngTuple[] = [
      [0, 0],
      [1, 1],
      [0, 2],
    ];
    expect(simplifyPolyline(line, 0.1)).toEqual(line);
  });

  it('returns short lines unchanged', () => {
    const line: LatLngTuple[] = [[-6.2, 106.8]];
    expect(simplifyPolyline(line, 1)).toEqual(line);
  });
});

describe('roundPolyline', () => {
  it('rounds to 5 decimals by default', () => {
    expect(roundPolyline([[-6.2098812, 106.8501849]])).toEqual([[-6.20988, 106.85018]]);
  });
});

describe('getKrlLineLayers', () => {
  it('merges metadata with geometry and puts the first listed line on top (drawn last)', () => {
    const layers = getKrlLineLayers([
      { id: 'cikarang', paths: [[[0, 0], [1, 1]]] },
      { id: 'bogor', paths: [[[0, 0], [2, 2]]] },
      { id: 'merak', paths: [] },
    ]);
    expect(layers.map((l) => l.id)).toEqual(['cikarang', 'bogor']);
    expect(layers[1].color).toBe(KRL_LINES[0].color);
  });

  it('ships geometry for every KRL line, inside the Jabodetabek and Banten area', () => {
    const layers = getKrlLineLayers();
    expect(layers.map((l) => l.id).sort()).toEqual(KRL_LINES.map((l) => l.id).sort());
    for (const layer of layers) {
      for (const [lat, lng] of layer.paths.flat()) {
        expect(lat).toBeGreaterThan(-7);
        expect(lat).toBeLessThan(-5.8);
        expect(lng).toBeGreaterThan(105.9);
        expect(lng).toBeLessThan(107.5);
      }
    }
  });
});
