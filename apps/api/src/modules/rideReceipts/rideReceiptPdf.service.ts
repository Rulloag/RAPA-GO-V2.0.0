import type { ReceiptMapImage } from "./rideReceiptMap.service.js";
import type { RideReceiptType } from "./rideReceipts.types.js";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 42;

const COLOR = {
  ink: [24, 24, 24] as const,
  muted: [100, 92, 81] as const,
  paper: [252, 249, 243] as const,
  white: [255, 255, 255] as const,
  gold: [214, 166, 64] as const,
  maroon: [143, 60, 36] as const,
  green: [22, 138, 72] as const,
  blue: [36, 89, 211] as const,
  red: [187, 42, 42] as const,
  border: [226, 213, 188] as const,
  legal: [255, 247, 222] as const,
};

type Rgb = readonly [number, number, number];

export interface RideReceiptPdfInput {
  type: RideReceiptType;
  documentNumber: string;
  generatedAt: Date;
  rideId: string;
  passengerName: string;
  passengerEmail: string;
  driverName: string | null;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  originText: string;
  destinationText: string;
  requestedAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
  arrivedAt: Date | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  amountClp: number;
  paymentMethod: string | null;
  paymentStatus: string;
  walletBenefitAppliedClp: number;
  priorityFeeClp: number;
  cancellationReason: string | null;
  noShowWaitMinutes: number | null;
  policyPercent: number | null;
  policyCapClp: number | null;
  legalDocumentTitle: string | null;
  legalDocumentVersion: string | null;
  legalAcceptedAt: Date | null;
  map: ReceiptMapImage;
  supportEmail: string;
  supportPhone: string;
}

function normalizePdfText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\xff]/g, "?");
}

function pdfEscape(value: string): string {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function colorCommand(color: Rgb, stroke = false): string {
  const components = color.map((value) => (value / 255).toFixed(4));
  return `${components.join(" ")} ${stroke ? "RG" : "rg"}`;
}

function textWidthEstimate(text: string, size: number): number {
  return normalizePdfText(text).length * size * 0.52;
}

function wrapText(
  value: string,
  maxWidth: number,
  fontSize: number,
): string[] {
  const words = normalizePdfText(value).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (textWidthEstimate(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function topToPdfY(top: number, height = 0): number {
  return PAGE_HEIGHT - top - height;
}

class PdfCanvas {
  readonly commands: string[] = [];

  fillRect(top: number, left: number, width: number, height: number, color: Rgb): void {
    this.commands.push(
      colorCommand(color),
      `${left.toFixed(2)} ${topToPdfY(top, height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re f`,
    );
  }

  strokeRect(
    top: number,
    left: number,
    width: number,
    height: number,
    color: Rgb,
    lineWidth = 1,
  ): void {
    this.commands.push(
      colorCommand(color, true),
      `${lineWidth.toFixed(2)} w`,
      `${left.toFixed(2)} ${topToPdfY(top, height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`,
    );
  }

  line(
    top: number,
    left: number,
    right: number,
    color: Rgb,
    lineWidth = 1,
  ): void {
    const y = topToPdfY(top);
    this.commands.push(
      colorCommand(color, true),
      `${lineWidth.toFixed(2)} w`,
      `${left.toFixed(2)} ${y.toFixed(2)} m ${right.toFixed(2)} ${y.toFixed(2)} l S`,
    );
  }

  text(
    value: string,
    top: number,
    left: number,
    options: {
      size?: number;
      bold?: boolean;
      color?: Rgb;
      align?: "left" | "right";
      width?: number;
    } = {},
  ): void {
    const size = options.size ?? 10;
    const color = options.color ?? COLOR.ink;
    const font = options.bold ? "/F2" : "/F1";
    const width = options.width ?? 0;
    const x =
      options.align === "right" && width > 0
        ? left + width - textWidthEstimate(value, size)
        : left;
    const baseline = topToPdfY(top + size);

    this.commands.push(
      "BT",
      colorCommand(color),
      `${font} ${size.toFixed(2)} Tf`,
      `1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm`,
      `(${pdfEscape(value)}) Tj`,
      "ET",
    );
  }

  wrappedText(
    value: string,
    top: number,
    left: number,
    maxWidth: number,
    options: {
      size?: number;
      bold?: boolean;
      color?: Rgb;
      lineHeight?: number;
      maxLines?: number;
    } = {},
  ): number {
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size * 1.28;
    const maximum = options.maxLines ?? 99;
    const lines = wrapText(value, maxWidth, size).slice(0, maximum);

    lines.forEach((line, index) => {
      this.text(line, top + index * lineHeight, left, {
        size,
        ...(options.bold !== undefined ? { bold: options.bold } : {}),
        ...(options.color !== undefined ? { color: options.color } : {}),
      });
    });

    return lines.length * lineHeight;
  }

  image(
    top: number,
    left: number,
    boxWidth: number,
    boxHeight: number,
    image: ReceiptMapImage,
  ): void {
    const ratio = Math.min(boxWidth / image.width, boxHeight / image.height);
    const width = image.width * ratio;
    const height = image.height * ratio;
    const x = left + (boxWidth - width) / 2;
    const y = topToPdfY(top + (boxHeight - height) / 2, height);

    this.commands.push(
      "q",
      `${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,
      "/Im1 Do",
      "Q",
    );
  }
}

function formatClp(value: number): string {
  return `$${Math.max(0, Math.round(value)).toLocaleString("es-CL")}`;
}

function formatDateTime(value: Date | null): string {
  if (!value) return "No informado";

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Pacific/Easter",
  }).format(value);
}

function formatDistance(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "No informada";
  if (value < 1_000) return `${Math.round(value)} m`;

  return `${(value / 1_000).toLocaleString("es-CL", {
    maximumFractionDigits: 1,
  })} km`;
}

function formatDuration(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "No informada";
  const minutes = Math.max(1, Math.round(value / 60));
  return `${minutes} min`;
}

function receiptTitle(type: RideReceiptType): string {
  switch (type) {
    case "completed_ride":
      return "COMPROBANTE DE VIAJE";
    case "cancelled_ride":
      return "COMPROBANTE DE CANCELACIÓN";
    case "no_show_closure":
      return "COMPROBANTE DE NO-SHOW";
    case "late_cancellation":
      return "COMPROBANTE DE CANCELACIÓN";
    case "no_show":
      return "COMPROBANTE DE NO-SHOW";
  }
}

function receiptBadge(type: RideReceiptType): {
  label: string;
  color: Rgb;
} {
  switch (type) {
    case "completed_ride":
      return { label: "VIAJE COMPLETADO", color: COLOR.green };
    case "cancelled_ride":
      return { label: "VIAJE CANCELADO", color: COLOR.maroon };
    case "no_show_closure":
      return { label: "NO-SHOW REGISTRADO", color: COLOR.red };
    case "late_cancellation":
      return { label: "CARGO APROBADO", color: COLOR.maroon };
    case "no_show":
      return { label: "NO-SHOW CONFIRMADO", color: COLOR.red };
  }
}

function vehicleLabel(input: RideReceiptPdfInput): string {
  return [
    input.vehicleBrand,
    input.vehicleModel,
    input.vehicleColor,
    input.vehiclePlate,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" · ") || "Vehículo no informado";
}

function paymentLabel(method: string | null): string {
  const normalized = method?.trim().toLowerCase();
  if (normalized === "cash" || normalized === "efectivo") return "Efectivo";
  if (normalized === "card" || normalized === "tarjeta") return "Tarjeta";
  return method?.trim() || "No informado";
}

function buildContent(input: RideReceiptPdfInput): string {
  const canvas = new PdfCanvas();
  const contentWidth = PAGE_WIDTH - MARGIN * 2;
  const badge = receiptBadge(input.type);

  canvas.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, COLOR.paper);
  canvas.fillRect(0, 0, PAGE_WIDTH, 18, COLOR.maroon);
  canvas.fillRect(18, 0, PAGE_WIDTH, 5, COLOR.gold);

  canvas.text("RAPA GO", 42, MARGIN, {
    size: 23,
    bold: true,
    color: COLOR.maroon,
  });
  canvas.text(receiptTitle(input.type), 72, MARGIN, {
    size: 13,
    bold: true,
  });
  canvas.text(input.documentNumber, 45, MARGIN, {
    size: 9,
    color: COLOR.muted,
    align: "right",
    width: contentWidth,
  });

  const badgeWidth = Math.max(115, textWidthEstimate(badge.label, 8.5) + 24);
  canvas.fillRect(72, PAGE_WIDTH - MARGIN - badgeWidth, badgeWidth, 23, badge.color);
  canvas.text(badge.label, 78, PAGE_WIDTH - MARGIN - badgeWidth + 12, {
    size: 8.5,
    bold: true,
    color: COLOR.white,
  });

  canvas.fillRect(112, MARGIN, contentWidth, 235, COLOR.white);
  canvas.strokeRect(112, MARGIN, contentWidth, 235, COLOR.border, 1);
  canvas.image(121, MARGIN + 9, contentWidth - 18, 176, input.map);

  if (input.map.provider === "osm_tiles") {
    canvas.text("Mapa © OpenStreetMap", 298, MARGIN, {
      size: 6.5,
      color: COLOR.muted,
      align: "right",
      width: contentWidth,
    });
  }

  canvas.fillRect(306, MARGIN + 10, 13, 13, COLOR.green);
  canvas.text("R", 308, MARGIN + 13.5, {
    size: 7,
    bold: true,
    color: COLOR.white,
  });
  canvas.wrappedText(
    `Recogida: ${input.originText}`,
    304,
    MARGIN + 31,
    contentWidth - 43,
    { size: 9.5, bold: true, maxLines: 2 },
  );

  canvas.fillRect(330, MARGIN + 10, 13, 13, COLOR.red);
  canvas.text("D", 332, MARGIN + 13.2, {
    size: 7,
    bold: true,
    color: COLOR.white,
  });
  canvas.wrappedText(
    `Destino: ${input.destinationText}`,
    328,
    MARGIN + 31,
    contentWidth - 43,
    { size: 9.5, bold: true, maxLines: 2 },
  );

  canvas.text("RESUMEN", 372, MARGIN, {
    size: 11,
    bold: true,
    color: COLOR.maroon,
  });
  canvas.line(390, MARGIN, PAGE_WIDTH - MARGIN, COLOR.border);

  const colWidth = (contentWidth - 18) / 2;
  const rightCol = MARGIN + colWidth + 18;

  canvas.text("Pasajero", 407, MARGIN, { size: 8, color: COLOR.muted });
  canvas.wrappedText(input.passengerName, 421, MARGIN, colWidth, {
    size: 10,
    bold: true,
    maxLines: 1,
  });
  canvas.text(input.passengerEmail, 437, MARGIN, {
    size: 8.3,
    color: COLOR.muted,
  });

  canvas.text("Conductor", 407, rightCol, { size: 8, color: COLOR.muted });
  canvas.wrappedText(input.driverName ?? "No asignado", 421, rightCol, colWidth, {
    size: 10,
    bold: true,
    maxLines: 1,
  });
  canvas.wrappedText(vehicleLabel(input), 437, rightCol, colWidth, {
    size: 8.3,
    color: COLOR.muted,
    maxLines: 2,
  });

  canvas.text("Fecha del servicio", 477, MARGIN, { size: 8, color: COLOR.muted });
  canvas.text(
    formatDateTime(input.completedAt ?? input.cancelledAt ?? input.requestedAt),
    491,
    MARGIN,
    { size: 9.2, bold: true },
  );

  canvas.text("Distancia y duración", 477, rightCol, { size: 8, color: COLOR.muted });
  canvas.text(
    `${formatDistance(input.distanceMeters)} · ${formatDuration(input.durationSeconds)}`,
    491,
    rightCol,
    { size: 9.2, bold: true },
  );

  canvas.fillRect(526, MARGIN, contentWidth, 92, COLOR.white);
  canvas.strokeRect(526, MARGIN, contentWidth, 92, COLOR.border, 1);
  canvas.text("Método de pago", 542, MARGIN + 17, {
    size: 8,
    color: COLOR.muted,
  });
  canvas.text(paymentLabel(input.paymentMethod), 557, MARGIN + 17, {
    size: 10,
    bold: true,
  });
  canvas.text(input.paymentStatus, 575, MARGIN + 17, {
    size: 8.5,
    color: COLOR.muted,
  });

  canvas.text("TOTAL", 542, MARGIN + 250, {
    size: 10,
    bold: true,
    color: COLOR.maroon,
  });
  canvas.text(formatClp(input.amountClp), 558, MARGIN + 250, {
    size: 25,
    bold: true,
    align: "right",
    width: contentWidth - 267,
  });

  let legalTop = 638;

  if (input.type === "completed_ride") {
    const extras: string[] = [];
    if (input.priorityFeeClp > 0) {
      extras.push(`Prioridad: ${formatClp(input.priorityFeeClp)}`);
    }
    if (input.walletBenefitAppliedClp > 0) {
      extras.push(`Beneficio aplicado: -${formatClp(input.walletBenefitAppliedClp)}`);
    }

    canvas.text(
      extras.length > 0
        ? extras.join(" · ")
        : "El total corresponde al valor final registrado por RAPA GO.",
      legalTop,
      MARGIN,
      { size: 8.6, color: COLOR.muted },
    );
    legalTop += 24;
  } else {
    canvas.fillRect(638, MARGIN, contentWidth, 116, COLOR.legal);
    canvas.strokeRect(638, MARGIN, contentWidth, 116, COLOR.gold, 1);
    const closureHeading =
      input.type === "cancelled_ride"
        ? "INFORMACIÓN DE LA CANCELACIÓN"
        : input.type === "no_show" || input.type === "no_show_closure"
          ? "INFORMACIÓN DEL NO-SHOW"
          : "INFORMACIÓN DEL CARGO";
    canvas.text(closureHeading, 654, MARGIN + 15, {
      size: 9.5,
      bold: true,
      color: COLOR.maroon,
    });

    const reason = input.cancellationReason ?? "Motivo no informado.";
    canvas.wrappedText(reason, 671, MARGIN + 15, contentWidth - 30, {
      size: 8.5,
      maxLines: 2,
    });

    const policy = [
      input.policyPercent == null ? null : `${input.policyPercent}%`,
      input.policyCapClp == null ? null : `tope ${formatClp(input.policyCapClp)}`,
      (input.type === "no_show" || input.type === "no_show_closure") &&
      input.noShowWaitMinutes != null
        ? `espera ${input.noShowWaitMinutes} min`
        : null,
    ].filter((value): value is string => Boolean(value));

    canvas.text(
      `Regla aplicada: ${policy.join(" · ") || "política vigente"}.`,
      704,
      MARGIN + 15,
      { size: 8.5, bold: true },
    );

    const acceptance = input.legalDocumentVersion && input.legalAcceptedAt
      ? `La política fue informada y aceptada previamente en ${input.legalDocumentTitle ?? "los términos y condiciones"}, versión ${input.legalDocumentVersion}, el ${formatDateTime(input.legalAcceptedAt)}.`
      : "El cargo se encuentra sujeto a la política vigente y al registro de aceptación disponible en RAPA GO.";

    canvas.wrappedText(acceptance, 721, MARGIN + 15, contentWidth - 30, {
      size: 8,
      color: COLOR.muted,
      maxLines: 3,
    });

    legalTop = 770;
  }

  canvas.line(787, MARGIN, PAGE_WIDTH - MARGIN, COLOR.border);
  canvas.text(
    "Este documento es un comprobante de servicio y no reemplaza una boleta o factura tributaria.",
    798,
    MARGIN,
    { size: 7.7, color: COLOR.muted },
  );
  canvas.text(
    `Soporte: ${input.supportEmail} · ${input.supportPhone}`,
    813,
    MARGIN,
    { size: 7.7, bold: true, color: COLOR.maroon },
  );
  canvas.text(`Viaje: ${input.rideId}`, 813, MARGIN, {
    size: 7.2,
    color: COLOR.muted,
    align: "right",
    width: contentWidth,
  });

  return canvas.commands.join("\n");
}

function buildPdf(
  content: string,
  map: ReceiptMapImage,
  metadata: { title: string; documentNumber: string },
): Buffer {
  const objects = new Map<number, Buffer>();
  const contentBuffer = Buffer.from(content, "latin1");
  const imageObject = map.filter === "DCTDecode"
    ? [
        "<< /Type /XObject /Subtype /Image",
        `/Width ${map.width}`,
        `/Height ${map.height}`,
        "/ColorSpace /DeviceRGB",
        "/BitsPerComponent 8",
        "/Filter /DCTDecode",
        `/Length ${map.data.length} >>`,
      ].join(" ")
    : [
        "<< /Type /XObject /Subtype /Image",
        `/Width ${map.width}`,
        `/Height ${map.height}`,
        "/ColorSpace /DeviceRGB",
        "/BitsPerComponent 8",
        "/Filter /FlateDecode",
        `/Length ${map.data.length} >>`,
      ].join(" ");

  objects.set(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"));
  objects.set(2, Buffer.from("<< /Type /Pages /Count 1 /Kids [3 0 R] >>", "latin1"));
  objects.set(
    3,
    Buffer.from(
      [
        "<< /Type /Page /Parent 2 0 R",
        `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}]`,
        "/Resources <<",
        "/Font << /F1 5 0 R /F2 6 0 R >>",
        "/XObject << /Im1 7 0 R >>",
        ">>",
        "/Contents 4 0 R >>",
      ].join(" "),
      "latin1",
    ),
  );
  objects.set(
    4,
    Buffer.concat([
      Buffer.from(`<< /Length ${contentBuffer.length} >>\nstream\n`, "latin1"),
      contentBuffer,
      Buffer.from("\nendstream", "latin1"),
    ]),
  );
  objects.set(
    5,
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "latin1",
    ),
  );
  objects.set(
    6,
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
      "latin1",
    ),
  );
  objects.set(
    7,
    Buffer.concat([
      Buffer.from(`${imageObject}\nstream\n`, "latin1"),
      map.data,
      Buffer.from("\nendstream", "latin1"),
    ]),
  );
  objects.set(
    8,
    Buffer.from(
      `<< /Title (${pdfEscape(metadata.title)}) /Subject (${pdfEscape(metadata.documentNumber)}) /Producer (RAPA GO) >>`,
      "latin1",
    ),
  );

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets: number[] = [0];
  let cursor = chunks[0]!.length;

  for (let id = 1; id <= 8; id += 1) {
    const body = objects.get(id);
    if (!body) throw new Error(`Missing PDF object ${id}.`);

    offsets[id] = cursor;
    const objectBuffer = Buffer.concat([
      Buffer.from(`${id} 0 obj\n`, "latin1"),
      body,
      Buffer.from("\nendobj\n", "latin1"),
    ]);

    chunks.push(objectBuffer);
    cursor += objectBuffer.length;
  }

  const xrefOffset = cursor;
  const xref = [
    "xref\n0 9\n",
    "0000000000 65535 f \n",
    ...Array.from({ length: 8 }, (_, index) => {
      const id = index + 1;
      return `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
    }),
    "trailer\n",
    "<< /Size 9 /Root 1 0 R /Info 8 0 R >>\n",
    "startxref\n",
    `${xrefOffset}\n`,
    "%%EOF\n",
  ].join("");

  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

export function generateRideReceiptPdf(input: RideReceiptPdfInput): Buffer {
  return buildPdf(buildContent(input), input.map, {
    title: receiptTitle(input.type),
    documentNumber: input.documentNumber,
  });
}
