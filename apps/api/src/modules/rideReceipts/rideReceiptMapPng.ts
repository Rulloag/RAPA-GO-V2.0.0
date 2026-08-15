import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CRC_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]!) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeAndData.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + data.length);
  return chunk;
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDelta = Math.abs(estimate - left);
  const upDelta = Math.abs(estimate - up);
  const upLeftDelta = Math.abs(estimate - upLeft);

  if (leftDelta <= upDelta && leftDelta <= upLeftDelta) return left;
  if (upDelta <= upLeftDelta) return up;
  return upLeft;
}

function unfilterScanline(
  filter: number,
  current: Buffer,
  previous: Buffer,
  bytesPerPixel: number,
): boolean {
  switch (filter) {
    case 0:
      return true;
    case 1:
      for (let index = bytesPerPixel; index < current.length; index += 1) {
        current[index] = (current[index]! + current[index - bytesPerPixel]!) & 0xff;
      }
      return true;
    case 2:
      for (let index = 0; index < current.length; index += 1) {
        current[index] = (current[index]! + previous[index]!) & 0xff;
      }
      return true;
    case 3:
      for (let index = 0; index < current.length; index += 1) {
        const left = index >= bytesPerPixel ? current[index - bytesPerPixel]! : 0;
        current[index] = (current[index]! + Math.floor((left + previous[index]!) / 2)) &
          0xff;
      }
      return true;
    case 4:
      for (let index = 0; index < current.length; index += 1) {
        const left = index >= bytesPerPixel ? current[index - bytesPerPixel]! : 0;
        const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel]! : 0;
        current[index] = (current[index]! +
          paethPredictor(left, previous[index]!, upLeft)) &
          0xff;
      }
      return true;
    default:
      return false;
  }
}

export function encodePngRgb(width: number, height: number, rgb: Buffer): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    const offset = y * (stride + 1);
    raw[offset] = 0;
    rgb.copy(raw, offset + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function decodePngToRgb(buffer: Buffer): {
  width: number;
  height: number;
  rgb: Buffer;
} | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = 1;
  let palette: Buffer | null = null;
  const idat: Buffer[] = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (length < 0 || dataEnd + 4 > buffer.length) return null;

    const data = buffer.subarray(dataStart, dataEnd);

    if (type === "IHDR") {
      if (data.length < 13) return null;
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  if (
    width <= 0 ||
    height <= 0 ||
    width > 4_096 ||
    height > 4_096 ||
    bitDepth !== 8 ||
    interlace !== 0
  ) {
    return null;
  }

  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : 0;
  if (!bytesPerPixel) return null;
  if (colorType === 3 && (!palette || palette.length < 3)) return null;

  let inflated: Buffer;
  try {
    inflated = inflateSync(Buffer.concat(idat));
  } catch {
    return null;
  }

  const stride = width * bytesPerPixel;
  const expected = (stride + 1) * height;
  if (inflated.length < expected) return null;

  const rgb = Buffer.alloc(width * height * 3);
  const previous = Buffer.alloc(stride);
  const current = Buffer.alloc(stride);
  let source = 0;
  let destination = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[source]!;
    source += 1;
    inflated.copy(current, 0, source, source + stride);
    source += stride;

    if (!unfilterScanline(filter, current, previous, bytesPerPixel)) {
      return null;
    }

    current.copy(previous);

    for (let x = 0; x < width; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 255;

      if (colorType === 2) {
        red = current[x * 3]!;
        green = current[x * 3 + 1]!;
        blue = current[x * 3 + 2]!;
      } else if (colorType === 6) {
        red = current[x * 4]!;
        green = current[x * 4 + 1]!;
        blue = current[x * 4 + 2]!;
        alpha = current[x * 4 + 3]!;
      } else {
        const paletteIndex = current[x]!;
        const paletteOffset = paletteIndex * 3;
        if (paletteOffset + 2 >= palette!.length) return null;
        red = palette![paletteOffset]!;
        green = palette![paletteOffset + 1]!;
        blue = palette![paletteOffset + 2]!;
      }

      if (alpha !== 255) {
        const blend = alpha / 255;
        red = Math.round(red * blend + 247 * (1 - blend));
        green = Math.round(green * blend + 247 * (1 - blend));
        blue = Math.round(blue * blend + 247 * (1 - blend));
      }

      rgb[destination] = red;
      rgb[destination + 1] = green;
      rgb[destination + 2] = blue;
      destination += 3;
    }
  }

  return { width, height, rgb };
}
