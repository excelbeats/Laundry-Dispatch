// Mapbox public token (pk.) — supplied via EXPO_PUBLIC_MAPBOX_TOKEN in the
// gitignored .env (and the build/deploy env). Safe to ship in the client bundle.
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

type Pt = { lat: number; lng: number };

// Mapbox Static Images API — a map snapshot with pins, works on web + native
// as a plain <Image>. Refreshing the driver point "moves" the map.
export function staticMapUrl(opts: { driver?: Pt; dest?: Pt; width?: number; height?: number }): string {
  const { driver, dest, width = 600, height = 340 } = opts;
  const markers: string[] = [];
  if (dest) markers.push(`pin-s+f74e4e(${dest.lng.toFixed(5)},${dest.lat.toFixed(5)})`);
  if (driver) markers.push(`pin-l+2563eb(${driver.lng.toFixed(5)},${driver.lat.toFixed(5)})`);
  const overlay = markers.join(',');

  let view: string;
  if (driver && dest) view = 'auto';
  else if (driver) view = `${driver.lng.toFixed(5)},${driver.lat.toFixed(5)},13`;
  else if (dest) view = `${dest.lng.toFixed(5)},${dest.lat.toFixed(5)},13`;
  else view = '-98,39,3';

  const path = overlay ? `${overlay}/${view}` : view;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${path}/${width}x${height}@2x?access_token=${MAPBOX_TOKEN}&padding=60`;
}

export function distanceMiles(a: Pt, b: Pt): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// rough city-driving ETA
export function etaMinutes(miles: number): number {
  return Math.max(1, Math.round((miles / 22) * 60));
}

// forward-geocode an address string to coordinates (Mapbox Geocoding API)
export async function geocode(query: string): Promise<Pt | null> {
  try {
    const r = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&country=US&access_token=${MAPBOX_TOKEN}`,
    );
    const j = await r.json();
    const c = j?.features?.[0]?.center;
    return Array.isArray(c) ? { lng: c[0], lat: c[1] } : null;
  } catch {
    return null;
  }
}
