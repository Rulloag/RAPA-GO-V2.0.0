import { deflateSync } from "node:zlib";

import { composeOsmBaseMap } from "./rideReceiptOsmMap.js";
import { decodePngToRgb } from "./rideReceiptMapPng.js";

export interface ReceiptRoutePoint {
  lat: number;
  lng: number;
}

export interface ReceiptMapBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ReceiptMapImage {
  data: Buffer;
  width: number;
  height: number;
  filter: "DCTDecode" | "FlateDecode";
  provider: "google_static_maps" | "osm_tiles" | "route_sketch";
  routePointCount: number;
}

const GOOGLE_STATIC_MAP_URL =
  "https://maps.googleapis.com/maps/api/staticmap";
const GOOGLE_DIRECTIONS_URL =
  "https://maps.googleapis.com/maps/api/directions/json";
const MAX_GOOGLE_ROUTE_POINTS = 80;
const MAP_TIMEOUT_MS = 9_000;
const MIN_MAP_SPAN_DEGREES = 0.02;
const MAP_BOUNDS_PADDING = 0.2;
const ROAD_SNAP_MIN_METERS = 80;

function isValidPoint(point: ReceiptRoutePoint): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function distanceMeters(
  first: ReceiptRoutePoint,
  second: ReceiptRoutePoint,
): number {
  const radius = 6_371_000;
  const toRad = (value: number): number => (value * Math.PI) / 180;
  const dLat = toRad(second.lat - first.lat);
  const dLng = toRad(second.lng - first.lng);
  const lat1 = toRad(first.lat);
  const lat2 = toRad(second.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function normalizeReceiptRoute(
  points: ReceiptRoutePoint[],
  origin: ReceiptRoutePoint | null,
  destination: ReceiptRoutePoint | null,
): ReceiptRoutePoint[] {
  const valid = points.filter(isValidPoint);
  const deduped: ReceiptRoutePoint[] = [];

  for (const point of valid) {
    const previous = deduped[deduped.length - 1];

    if (!previous || distanceMeters(previous, point) >= 3) {
      deduped.push(point);
    }
  }

  const capturedDistanceMeters = deduped.reduce((total, point, index) => {
    const previous = deduped[index - 1];
    return previous ? total + distanceMeters(previous, point) : total;
  }, 0);

  // Si el GPS quedó prácticamente inmóvil (pruebas en navegador, permisos o
  // cierre rápido), no dibujamos una rayita engañosa. Mostramos una referencia
  // amplia entre recogida y destino, siempre que ambos puntos sean válidos.
  if (
    capturedDistanceMeters < 25 &&
    origin &&
    destination &&
    isValidPoint(origin) &&
    isValidPoint(destination) &&
    distanceMeters(origin, destination) >= 25
  ) {
    return [origin, destination];
  }

  const route = [...deduped];

  if (origin && isValidPoint(origin)) {
    const first = route[0];
    if (!first || distanceMeters(origin, first) > 12) {
      route.unshift(origin);
    }
  }

  if (destination && isValidPoint(destination)) {
    const last = route[route.length - 1];
    if (!last || distanceMeters(last, destination) > 12) {
      route.push(destination);
    }
  }

  if (route.length === 1 && origin && destination) {
    route.push(destination);
  }

  return route;
}

export function fitReceiptMapBounds(route: ReceiptRoutePoint[]): ReceiptMapBounds {
  const latitudes = route.map((point) => point.lat);
  const longitudes = route.map((point) => point.lng);
  const rawMinLat = Math.min(...latitudes);
  const rawMaxLat = Math.max(...latitudes);
  const rawMinLng = Math.min(...longitudes);
  const rawMaxLng = Math.max(...longitudes);
  const latCenter = (rawMinLat + rawMaxLat) / 2;
  const lngCenter = (rawMinLng + rawMaxLng) / 2;
  const latSpan = Math.max(MIN_MAP_SPAN_DEGREES, rawMaxLat - rawMinLat);
  const lngSpan = Math.max(MIN_MAP_SPAN_DEGREES, rawMaxLng - rawMinLng);
  const paddedLatSpan = latSpan * (1 + MAP_BOUNDS_PADDING * 2);
  const paddedLngSpan = lngSpan * (1 + MAP_BOUNDS_PADDING * 2);

  return {
    minLat: latCenter - paddedLatSpan / 2,
    maxLat: latCenter + paddedLatSpan / 2,
    minLng: lngCenter - paddedLngSpan / 2,
    maxLng: lngCenter + paddedLngSpan / 2,
  };
}

function downsampleRoute(
  points: ReceiptRoutePoint[],
  maximum: number,
): ReceiptRoutePoint[] {
  if (points.length <= maximum) return points;

  const result: ReceiptRoutePoint[] = [];
  const lastIndex = points.length - 1;

  for (let index = 0; index < maximum; index += 1) {
    const sourceIndex = Math.round((index * lastIndex) / (maximum - 1));
    const point = points[sourceIndex];
    if (point) result.push(point);
  }

  return result;
}

function encodeSignedNumber(value: number): string {
  let shifted = value < 0 ? ~(value << 1) : value << 1;
  let output = "";

  while (shifted >= 0x20) {
    output += String.fromCharCode((0x20 | (shifted & 0x1f)) + 63);
    shifted >>= 5;
  }

  output += String.fromCharCode(shifted + 63);
  return output;
}

export function encodeGooglePolyline(points: ReceiptRoutePoint[]): string {
  let previousLat = 0;
  let previousLng = 0;
  let encoded = "";

  for (const point of points) {
    const latitude = Math.round(point.lat * 100_000);
    const longitude = Math.round(point.lng * 100_000);

    encoded += encodeSignedNumber(latitude - previousLat);
    encoded += encodeSignedNumber(longitude - previousLng);

    previousLat = latitude;
    previousLng = longitude;
  }

  return encoded;
}

export function decodeGooglePolyline(encoded: string): ReceiptRoutePoint[] {
  const points: ReceiptRoutePoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const next = (): number => {
      let result = 0;
      let shift = 0;
      let byte = 0;

      do {
        byte = encoded.charCodeAt(index) - 63;
        index += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);

      return result & 1 ? ~(result >> 1) : result >> 1;
    };

    latitude += next();
    longitude += next();
    points.push({
      lat: latitude / 100_000,
      lng: longitude / 100_000,
    });
  }

  return points.filter(isValidPoint);
}

function parseJpegDimensions(buffer: Buffer): {
  width: number;
  height: number;
} | null {
  if (
    buffer.length < 4 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8
  ) {
    return null;
  }

  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker == null) return null;

    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > buffer.length) {
      return null;
    }

    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xc3;

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += length + 2;
  }

  return null;
}

function logMapWarning(message: string, details?: Record<string, unknown>): void {
  if (details) {
    console.warn(`[RideReceipts] ${message}`, details);
    return;
  }

  console.warn(`[RideReceipts] ${message}`);
}

export function buildGoogleStaticMapUrl(
  route: ReceiptRoutePoint[],
  origin: ReceiptRoutePoint,
  destination: ReceiptRoutePoint,
  apiKey: string,
): string {
  const sampled = downsampleRoute(route, MAX_GOOGLE_ROUTE_POINTS);
  const bounds = fitReceiptMapBounds(route);
  const url = new URL(GOOGLE_STATIC_MAP_URL);

  url.searchParams.set("size", "600x300");
  url.searchParams.set("scale", "2");
  url.searchParams.set("format", "jpg-baseline");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("language", "es");
  url.searchParams.set("region", "cl");
  url.searchParams.append(
    "visible",
    `${bounds.minLat.toFixed(5)},${bounds.minLng.toFixed(5)}|${bounds.maxLat.toFixed(5)},${bounds.maxLng.toFixed(5)}`,
  );
  url.searchParams.append(
    "path",
    `color:0x2459d3ff|weight:5|enc:${encodeGooglePolyline(sampled)}`,
  );
  url.searchParams.append(
    "markers",
    `color:0x16a34a|label:R|${origin.lat},${origin.lng}`,
  );
  url.searchParams.append(
    "markers",
    `color:0xdc2626|label:D|${destination.lat},${destination.lng}`,
  );
  url.searchParams.set("key", apiKey);

  return url.toString();
}

async function fetchGoogleMap(
  route: ReceiptRoutePoint[],
  origin: ReceiptRoutePoint,
  destination: ReceiptRoutePoint,
  apiKey: string,
): Promise<ReceiptMapImage | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAP_TIMEOUT_MS);

  try {
    const response = await fetch(
      buildGoogleStaticMapUrl(route, origin, destination, apiKey),
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          Accept: "image/jpeg,image/png",
          "User-Agent": "RAPA-GO-Receipt-Service/2.0",
        },
      },
    );

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

    if (!response.ok) {
      logMapWarning("Google Static Maps no disponible.", {
        status: response.status,
        contentType,
      });
      return null;
    }

    const data = Buffer.from(await response.arrayBuffer());

    if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) {
      const dimensions = parseJpegDimensions(data);
      if (!dimensions || data.length < 1_000) {
        logMapWarning("Google Static Maps devolvió un JPEG inválido.");
        return null;
      }

      return {
        data,
        width: dimensions.width,
        height: dimensions.height,
        filter: "DCTDecode",
        provider: "google_static_maps",
        routePointCount: route.length,
      };
    }

    if (contentType.includes("image/png") || data.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )) {
      const decoded = decodePngToRgb(data);
      if (!decoded || decoded.width < 400 || decoded.height < 180 || data.length < 3_000) {
        logMapWarning("Google Static Maps devolvió un PNG de error o demasiado pequeño.");
        return null;
      }

      return {
        data: deflateSync(decoded.rgb, { level: 9 }),
        width: decoded.width,
        height: decoded.height,
        filter: "FlateDecode",
        provider: "google_static_maps",
        routePointCount: route.length,
      };
    }

    logMapWarning("Google Static Maps devolvió un tipo no usable.", { contentType });
    return null;
  } catch {
    logMapWarning("Google Static Maps falló por red o timeout.");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDrivingRoute(
  origin: ReceiptRoutePoint,
  destination: ReceiptRoutePoint,
  apiKey: string,
): Promise<ReceiptRoutePoint[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAP_TIMEOUT_MS);
  const url = new URL(GOOGLE_DIRECTIONS_URL);
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("region", "cl");
  url.searchParams.set("language", "es");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "RAPA-GO-Receipt-Service/2.0",
      },
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      status?: string;
      routes?: Array<{ overview_polyline?: { points?: string } }>;
    };

    if (payload.status !== "OK") return null;

    const encoded = payload.routes?.[0]?.overview_polyline?.points;
    if (typeof encoded !== "string" || encoded.length < 8) return null;

    const decoded = decodeGooglePolyline(encoded);
    return decoded.length >= 3 ? decoded : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveDisplayRoute(
  route: ReceiptRoutePoint[],
  origin: ReceiptRoutePoint,
  destination: ReceiptRoutePoint,
  apiKey: string | null,
): Promise<ReceiptRoutePoint[]> {
  if (!apiKey || route.length >= 4) return route;
  if (distanceMeters(origin, destination) < ROAD_SNAP_MIN_METERS) return route;

  const driven = await fetchDrivingRoute(origin, destination, apiKey);
  return driven ?? route;
}

function setPixel(
  pixels: Buffer,
  width: number,
  height: number,
  x: number,
  y: number,
  color: readonly [number, number, number],
): void {
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);

  if (
    roundedX < 0 ||
    roundedX >= width ||
    roundedY < 0 ||
    roundedY >= height
  ) {
    return;
  }

  const offset = (roundedY * width + roundedX) * 3;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
}

function drawLine(
  pixels: Buffer,
  width: number,
  height: number,
  start: { x: number; y: number },
  end: { x: number; y: number },
  color: readonly [number, number, number],
  thickness: number,
): void {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));

  for (let step = 0; step <= steps; step += 1) {
    const ratio = step / steps;
    const x = start.x + dx * ratio;
    const y = start.y + dy * ratio;

    for (let offsetY = -thickness; offsetY <= thickness; offsetY += 1) {
      for (let offsetX = -thickness; offsetX <= thickness; offsetX += 1) {
        if (offsetX * offsetX + offsetY * offsetY <= thickness * thickness) {
          setPixel(
            pixels,
            width,
            height,
            x + offsetX,
            y + offsetY,
            color,
          );
        }
      }
    }
  }
}

function drawCircle(
  pixels: Buffer,
  width: number,
  height: number,
  center: { x: number; y: number },
  radius: number,
  color: readonly [number, number, number],
): void {
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (x * x + y * y <= radius * radius) {
        setPixel(
          pixels,
          width,
          height,
          center.x + x,
          center.y + y,
          color,
        );
      }
    }
  }
}

function overlayRoute(
  pixels: Buffer,
  width: number,
  height: number,
  projected: Array<{ x: number; y: number }>,
  thickness: number,
): void {
  for (let index = 1; index < projected.length; index += 1) {
    const start = projected[index - 1];
    const end = projected[index];

    if (start && end) {
      drawLine(pixels, width, height, start, end, [36, 89, 211], thickness);
    }
  }

  const first = projected[0];
  const last = projected[projected.length - 1];

  if (first) {
    drawCircle(pixels, width, height, first, 16, [22, 163, 74]);
    drawCircle(pixels, width, height, first, 7, [255, 255, 255]);
  }

  if (last) {
    drawCircle(pixels, width, height, last, 16, [220, 38, 38]);
    drawCircle(pixels, width, height, last, 7, [255, 255, 255]);
  }
}

function createRouteSketch(route: ReceiptRoutePoint[]): ReceiptMapImage {
  const width = 1_000;
  const height = 440;
  const pixels = Buffer.alloc(width * height * 3, 247);
  const padding = 60;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      const grid = x % 120 < 2 || y % 100 < 2;
      const coast = x < width * 0.13;

      if (coast) {
        pixels[offset] = 219;
        pixels[offset + 1] = 239;
        pixels[offset + 2] = 248;
      } else if (grid) {
        pixels[offset] = 226;
        pixels[offset + 1] = 229;
        pixels[offset + 2] = 232;
      } else {
        pixels[offset] = 246;
        pixels[offset + 1] = 242;
        pixels[offset + 2] = 233;
      }
    }
  }

  const latitudes = route.map((point) => point.lat);
  const longitudes = route.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = Math.max(0.0005, maxLat - minLat);
  const lngSpan = Math.max(0.0005, maxLng - minLng);

  overlayRoute(
    pixels,
    width,
    height,
    route.map((point) => ({
      x: padding + ((point.lng - minLng) / lngSpan) * (width - padding * 2),
      y: padding + ((maxLat - point.lat) / latSpan) * (height - padding * 2),
    })),
    5,
  );

  return {
    data: deflateSync(pixels, { level: 9 }),
    width,
    height,
    filter: "FlateDecode",
    provider: "route_sketch",
    routePointCount: route.length,
  };
}

async function createOsmMap(route: ReceiptRoutePoint[]): Promise<ReceiptMapImage | null> {
  const bounds = fitReceiptMapBounds(route);
  const composed = await composeOsmBaseMap({
    ...bounds,
    width: 1_000,
    height: 440,
  });

  if (!composed) return null;

  overlayRoute(
    composed.pixels,
    composed.width,
    composed.height,
    route.map((point) => composed.project(point)),
    4,
  );

  return {
    data: deflateSync(composed.pixels, { level: 9 }),
    width: composed.width,
    height: composed.height,
    filter: "FlateDecode",
    provider: "osm_tiles",
    routePointCount: route.length,
  };
}

function configuredGoogleKey(): string | null {
  const value = process.env["GOOGLE_MAPS_API_KEY"]?.trim() ?? "";

  if (
    !value ||
    value.startsWith("REEMPLAZAR") ||
    value === "REDACTED_GOOGLE_MAPS_API_KEY"
  ) {
    return null;
  }

  return value;
}

function configuredProvider(): string {
  return process.env["RIDE_RECEIPTS_MAP_PROVIDER"]?.trim().toLowerCase() ?? "google";
}

export class RideReceiptMapService {
  async render(input: {
    points: ReceiptRoutePoint[];
    origin: ReceiptRoutePoint | null;
    destination: ReceiptRoutePoint | null;
  }): Promise<ReceiptMapImage> {
    const route = normalizeReceiptRoute(
      input.points,
      input.origin,
      input.destination,
    );

    const safeRoute =
      route.length >= 2
        ? route
        : [
            input.origin ?? { lat: -27.15, lng: -109.43 },
            input.destination ?? { lat: -27.14, lng: -109.42 },
          ];

    const origin = safeRoute[0]!;
    const destination = safeRoute[safeRoute.length - 1]!;
    const apiKey = configuredGoogleKey();
    const provider = configuredProvider();
    const displayRoute = await resolveDisplayRoute(
      safeRoute,
      origin,
      destination,
      apiKey,
    );

    if (apiKey && provider !== "sketch" && provider !== "osm") {
      const googleImage = await fetchGoogleMap(
        displayRoute,
        origin,
        destination,
        apiKey,
      );

      if (googleImage) return googleImage;
    }

    if (provider !== "sketch") {
      const osmImage = await createOsmMap(displayRoute);
      if (osmImage) return osmImage;

      logMapWarning("Mapa OSM no disponible; se usa el trazado local de respaldo.");
    }

    return createRouteSketch(displayRoute);
  }
}
