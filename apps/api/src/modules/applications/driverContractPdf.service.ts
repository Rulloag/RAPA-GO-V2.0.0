import type { Application, LegalDocument } from "../../db/schema/index.js";

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

function wrapLine(value: string, width = 88): string[] {
  const clean = value.replace(/\s+/g, " ").trim();

  if (!clean) return [""];

  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= width) {
      current = next;
      continue;
    }

    if (current) lines.push(current);

    if (word.length <= width) {
      current = word;
      continue;
    }

    for (let index = 0; index < word.length; index += width) {
      lines.push(word.slice(index, index + width));
    }
    current = "";
  }

  if (current) lines.push(current);
  return lines;
}

function pdfEscape(value: string): string {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function paginate(lines: string[], pageSize = 47): string[][] {
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += pageSize) {
    pages.push(lines.slice(index, index + pageSize));
  }

  return pages.length > 0 ? pages : [[""]];
}

function buildPdfFromLines(lines: string[]): Buffer {
  const pages = paginate(lines);
  const pageObjectIds = pages.map((_, index) => 3 + index * 2);
  const streamObjectIds = pages.map((_, index) => 4 + index * 2);
  const fontObjectId = 3 + pages.length * 2;
  const objects = new Map<number, Buffer>();

  objects.set(
    1,
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
  );

  objects.set(
    2,
    Buffer.from(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] >>`,
      "latin1",
    ),
  );

  pages.forEach((pageLines, index) => {
    const pageId = pageObjectIds[index]!;
    const streamId = streamObjectIds[index]!;
    const content = [
      "BT",
      "/F1 9 Tf",
      "48 800 Td",
      "13 TL",
      ...pageLines.flatMap((line) => [
        `(${pdfEscape(line)}) Tj`,
        "T*",
      ]),
      "ET",
    ].join("\n");
    const contentBuffer = Buffer.from(content, "latin1");

    objects.set(
      pageId,
      Buffer.from(
        [
          "<< /Type /Page",
          "/Parent 2 0 R",
          "/MediaBox [0 0 595 842]",
          `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >>`,
          `/Contents ${streamId} 0 R >>`,
        ].join(" "),
        "latin1",
      ),
    );

    objects.set(
      streamId,
      Buffer.concat([
        Buffer.from(`<< /Length ${contentBuffer.length} >>\nstream\n`, "latin1"),
        contentBuffer,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );
  });

  objects.set(
    fontObjectId,
    Buffer.from(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
      "latin1",
    ),
  );

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  const offsets: number[] = [0];
  let cursor = chunks[0]!.length;

  for (let id = 1; id <= fontObjectId; id += 1) {
    const body = objects.get(id);

    if (!body) {
      throw new Error(`Missing PDF object ${id}.`);
    }

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
    `xref\n0 ${fontObjectId + 1}\n`,
    "0000000000 65535 f \n",
    ...Array.from({ length: fontObjectId }, (_, index) => {
      const id = index + 1;
      return `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
    }),
    "trailer\n",
    `<< /Size ${fontObjectId + 1} /Root 1 0 R >>\n`,
    "startxref\n",
    `${xrefOffset}\n`,
    "%%EOF\n",
  ].join("");

  chunks.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(chunks);
}

export function generateDriverContractPdf(
  application: Application,
  legalDocument: LegalDocument,
): Buffer {
  const acceptedAt =
    application.driverContractAcceptedAt?.toISOString() ??
    application.createdAt.toISOString();

  const acceptance =
    application.driverContractAcceptance &&
    typeof application.driverContractAcceptance === "object"
      ? application.driverContractAcceptance
      : {};

  const evidenceLines = [
    "RAPA GO - CONTRATO ACEPTADO POR CONDUCTOR",
    "",
    `Documento: ${legalDocument.title}`,
    `Version: ${legalDocument.version}`,
    `Identificador de postulacion: ${application.id}`,
    `Identificador de cuenta: ${application.userId ?? "Sin cuenta asociada"}`,
    `Conductor: ${application.firstName} ${application.lastName}`,
    `RUT: ${application.rut ?? "No informado"}`,
    `Correo: ${application.email}`,
    `Telefono: ${application.phone}`,
    `Fecha y hora de aceptacion: ${acceptedAt}`,
    `Franja de desconexion: ${application.restWindowStart ?? "--:--"} a ${application.restWindowEnd ?? "--:--"}`,
    "",
    "DECLARACIONES ELECTRONICAS",
    `Contrato y anexos: ${acceptance["acceptedContract"] === true ? "ACEPTADO" : "NO REGISTRADO"}`,
    `Datos y documentos autenticos: ${acceptance["acceptedDocumentsTruth"] === true ? "ACEPTADO" : "NO REGISTRADO"}`,
    `Naturaleza independiente: ${acceptance["acceptedIndependentNature"] === true ? "ACEPTADO" : "NO REGISTRADO"}`,
    `Politica de Privacidad: ${acceptance["acceptedPrivacyGeolocation"] === true ? "ACEPTADO" : "NO REGISTRADO"}`,
    ...(acceptance["acceptedSensitiveData"] !== undefined
      ? [`Datos sensibles (cuando corresponde): ${acceptance["acceptedSensitiveData"] === true ? "ACEPTADO" : "NO ACEPTADO"}`]
      : []),
    `Franja de desconexion: ${acceptance["acceptedRestWindow"] === true ? "ACEPTADO" : "NO REGISTRADO"}`,
    `Ejecucion personal del servicio: ${acceptance["acceptedPersonalService"] === true ? "ACEPTADO" : "NO REGISTRADO"}`,
    "",
    "IMPORTANTE",
    "La aceptacion contractual no habilita por si sola la cuenta del conductor.",
    "La habilitacion depende de la revision documental, capacitacion, vehiculo, franja de desconexion y demas condiciones previas.",
    "",
    "TEXTO INTEGRO DEL CONTRATO",
    "",
  ];

  const contractLines = legalDocument.content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .flatMap((line) => wrapLine(line));

  return buildPdfFromLines([
    ...evidenceLines.flatMap((line) => wrapLine(line)),
    ...contractLines,
  ]);
}

export function generateLegalDocumentPdf(
  legalDocument: LegalDocument,
  heading = "RAPA GO - DOCUMENTO LEGAL",
): Buffer {
  const lines = [
    heading,
    "",
    `Documento: ${legalDocument.title}`,
    `Version: ${legalDocument.version}`,
    `Vigente desde: ${legalDocument.effectiveDate}`,
    "",
    ...legalDocument.content
      .replace(/\r\n/g, "\n")
      .split("\n")
      .flatMap((line) => wrapLine(line)),
  ];

  return buildPdfFromLines(lines);
}
