import { deflateSync } from "node:zlib";

export interface ReceiptRoutePoint {
  lat: number;
  lng: number;
}

export interface ReceiptMapImage {
  data: Buffer;
  width: number;
  height: number;
  filter: "DCTDecode" | "FlateDecode";
  provider: "google_static_maps" | "route_sketch";
  routePointCount: number;
}

const GOOGLE_STATIC_MAP_URL =
  "https://maps.googleapis.com/maps/api/staticmap";
const MAX_GOOGLE_ROUTE_POINTS = 80;
const MAP_TIMEOUT_MS = 9_000;

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

function buildGoogleStaticMapUrl(
  route: ReceiptRoutePoint[],
  origin: ReceiptRoutePoint,
  destination: ReceiptRoutePoint,
  apiKey: string,
): string {
  const sampled = downsampleRoute(route, MAX_GOOGLE_ROUTE_POINTS);
  const url = new URL(GOOGLE_STATIC_MAP_URL);

  url.searchParams.set("size", "600x300");
  url.searchParams.set("scale", "2");
  url.searchParams.set("format", "jpg-baseline");
  url.searchParams.set("maptype", "roadmap");
  url.searchParams.set("language", "es");
  url.searchParams.set("region", "cl");
  url.searchParams.append(
    "path",
    `color:0x2459d3ff|weight:7|enc:${encodeGooglePolyline(sampled)}`,
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
          Accept: "image/jpeg",
          "User-Agent": "RAPA-GO-Receipt-Service/2.0",
        },
      },
    );

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("image/jpeg")) return null;

    const data = Buffer.from(await response.arrayBuffer());
    const dimensions = parseJpegDimensions(data);

    if (!dimensions || data.length < 1_000) return null;

    return {
      data,
      width: dimensions.width,
      height: dimensions.height,
      filter: "DCTDecode",
      provider: "google_static_maps",
      routePointCount: route.length,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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

  const projected = route.map((point) => ({
    x: padding + ((point.lng - minLng) / lngSpan) * (width - padding * 2),
    y:
      padding +
      ((maxLat - point.lat) / latSpan) * (height - padding * 2),
  }));

  for (let index = 1; index < projected.length; index += 1) {
    const start = projected[index - 1];
    const end = projected[index];

    if (start && end) {
      drawLine(
        pixels,
        width,
        height,
        start,
        end,
        [36, 89, 211],
        7,
      );
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

  return {
    data: deflateSync(pixels, { level: 9 }),
    width,
    height,
    filter: "FlateDecode",
    provider: "route_sketch",
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
    const provider =
      process.env["RIDE_RECEIPTS_MAP_PROVIDER"]?.trim().toLowerCase() ??
      "google";

    if (apiKey && provider !== "sketch") {
      const googleImage = await fetchGoogleMap(
        safeRoute,
        origin,
        destination,
        apiKey,
      );

      if (googleImage) return googleImage;
    }

    return createRouteSketch(safeRoute);
  }
}
