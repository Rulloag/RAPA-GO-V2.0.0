import { decodePngToRgb } from "./rideReceiptMapPng.js";

export interface OsmLatLng {
  lat: number;
  lng: number;
}

export interface OsmBaseMap {
  pixels: Buffer;
  width: number;
  height: number;
  project: (point: OsmLatLng) => { x: number; y: number };
}

const TILE_SIZE = 256;
const OSM_TILE_URL = "https://tile.openstreetmap.org";
const OSM_USER_AGENT =
  "RAPA-GO-Receipt-Service/2.0 (https://rapago.cl; ride-receipt-maps)";
const OSM_TIMEOUT_MS = 8_000;
const OSM_CONCURRENCY = 4;
const MAX_TILES = 24;
const MIN_ZOOM = 11;
const MAX_ZOOM = 16;
const SEA_COLOR = [185, 215, 234] as const;

function mercatorX(lng: number): number {
  return (lng + 180) / 360;
}

function mercatorY(lat: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sine = Math.sin((clamped * Math.PI) / 180);
  return 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI);
}

function wrapTileX(tileX: number, tileCount: number): number {
  return ((tileX % tileCount) + tileCount) % tileCount;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index]!);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

function blitTile(
  destination: Buffer,
  destWidth: number,
  destHeight: number,
  tileRgb: Buffer,
  destX: number,
  destY: number,
): void {
  for (let row = 0; row < TILE_SIZE; row += 1) {
    const targetY = destY + row;
    if (targetY < 0 || targetY >= destHeight) continue;

    for (let column = 0; column < TILE_SIZE; column += 1) {
      const targetX = destX + column;
      if (targetX < 0 || targetX >= destWidth) continue;

      const source = (row * TILE_SIZE + column) * 3;
      const target = (targetY * destWidth + targetX) * 3;
      destination[target] = tileRgb[source]!;
      destination[target + 1] = tileRgb[source + 1]!;
      destination[target + 2] = tileRgb[source + 2]!;
    }
  }
}

function chooseZoom(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  width: number,
  height: number,
): number {
  for (let zoom = MAX_ZOOM; zoom >= MIN_ZOOM; zoom -= 1) {
    const world = TILE_SIZE * 2 ** zoom;
    const pixelWidth = (maxX - minX) * world;
    const pixelHeight = (maxY - minY) * world;
    const tilesX = Math.ceil(pixelWidth / TILE_SIZE) + 1;
    const tilesY = Math.ceil(pixelHeight / TILE_SIZE) + 1;

    if (
      pixelWidth <= width &&
      pixelHeight <= height &&
      tilesX * tilesY <= MAX_TILES
    ) {
      return zoom;
    }
  }

  return MIN_ZOOM;
}

export async function composeOsmBaseMap(input: {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  width: number;
  height: number;
}): Promise<OsmBaseMap | null> {
  const width = input.width;
  const height = input.height;
  const boundsMinX = mercatorX(input.minLng);
  const boundsMaxX = mercatorX(input.maxLng);
  const boundsMinY = mercatorY(input.maxLat);
  const boundsMaxY = mercatorY(input.minLat);

  if (boundsMaxX <= boundsMinX || boundsMaxY <= boundsMinY) return null;

  const zoom = chooseZoom(
    boundsMinX,
    boundsMaxX,
    boundsMinY,
    boundsMaxY,
    width,
    height,
  );
  const world = TILE_SIZE * 2 ** zoom;
  const tileCount = 2 ** zoom;
  const centerX = ((boundsMinX + boundsMaxX) / 2) * world;
  const centerY = ((boundsMinY + boundsMaxY) / 2) * world;
  const topLeftX = centerX - width / 2;
  const topLeftY = centerY - height / 2;

  const tileMinX = Math.floor(topLeftX / TILE_SIZE);
  const tileMaxX = Math.floor((topLeftX + width - 1) / TILE_SIZE);
  const tileMinY = Math.max(0, Math.floor(topLeftY / TILE_SIZE));
  const tileMaxY = Math.min(tileCount - 1, Math.floor((topLeftY + height - 1) / TILE_SIZE));

  const tiles: Array<{ tileX: number; tileY: number }> = [];
  for (let tileY = tileMinY; tileY <= tileMaxY; tileY += 1) {
    for (let tileX = tileMinX; tileX <= tileMaxX; tileX += 1) {
      tiles.push({ tileX, tileY });
    }
  }

  if (tiles.length === 0 || tiles.length > MAX_TILES) return null;

  const pixels = Buffer.alloc(width * height * 3);
  for (let index = 0; index < pixels.length; index += 3) {
    pixels[index] = SEA_COLOR[0];
    pixels[index + 1] = SEA_COLOR[1];
    pixels[index + 2] = SEA_COLOR[2];
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSM_TIMEOUT_MS);

  try {
    const fetched = await mapPool(tiles, OSM_CONCURRENCY, async (tile) => {
      const wrappedX = wrapTileX(tile.tileX, tileCount);
      const url = `${OSM_TILE_URL}/${zoom}/${wrappedX}/${tile.tileY}.png`;

      try {
        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "image/png",
            "User-Agent": OSM_USER_AGENT,
          },
        });

        if (!response.ok) return null;

        const decoded = decodePngToRgb(Buffer.from(await response.arrayBuffer()));
        if (!decoded || decoded.width !== TILE_SIZE || decoded.height !== TILE_SIZE) {
          return null;
        }

        return { tile, rgb: decoded.rgb };
      } catch {
        return null;
      }
    });

    let painted = 0;

    for (const tileImage of fetched) {
      if (!tileImage) continue;

      blitTile(
        pixels,
        width,
        height,
        tileImage.rgb,
        Math.round(tileImage.tile.tileX * TILE_SIZE - topLeftX),
        Math.round(tileImage.tile.tileY * TILE_SIZE - topLeftY),
      );
      painted += 1;
    }

    if (painted < 2) return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  return {
    pixels,
    width,
    height,
    project: (point) => ({
      x: mercatorX(point.lng) * world - topLeftX,
      y: mercatorY(point.lat) * world - topLeftY,
    }),
  };
}
