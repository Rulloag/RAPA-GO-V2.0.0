export type RapaNuiZoneId =
  | "hanga_roa"
  | "mataveri"
  | "anakena"
  | "rano_raraku"
  | "tongariki"
  | "rano_kau_orongo"
  | "vaihu_sur"
  | "interior"
  | "desconocida";

export interface RapaNuiZone {
  id: RapaNuiZoneId;
  label: string;
  description: string;
  sortOrder: number;
}

export const RAPA_NUI_ZONES: RapaNuiZone[] = [
  { id: "hanga_roa",       label: "Hanga Roa",         description: "Centro urbano principal",           sortOrder: 1 },
  { id: "mataveri",        label: "Mataveri",           description: "Sector aeropuerto y alrededores",   sortOrder: 2 },
  { id: "anakena",         label: "Anakena",            description: "Playa Anakena y costa norte",       sortOrder: 3 },
  { id: "rano_raraku",     label: "Rano Raraku",        description: "Volcán y cantera de moais",         sortOrder: 4 },
  { id: "tongariki",       label: "Tongariki",          description: "Sector Ahu Tongariki",              sortOrder: 5 },
  { id: "rano_kau_orongo", label: "Rano Kau / Orongo",  description: "Volcán Rano Kau y aldea Orongo",    sortOrder: 6 },
  { id: "vaihu_sur",       label: "Vaihu / Sur",        description: "Sector sur de la isla",             sortOrder: 7 },
  { id: "interior",        label: "Interior",           description: "Zona interior de la isla",          sortOrder: 8 },
  { id: "desconocida",     label: "Zona no informada",  description: "El conductor no ha indicado zona",  sortOrder: 9 },
];

export const RAPA_NUI_ZONE_LABEL: Record<RapaNuiZoneId, string> = Object.fromEntries(
  RAPA_NUI_ZONES.map(z => [z.id, z.label])
) as Record<RapaNuiZoneId, string>;

export function getZoneLabel(id: RapaNuiZoneId | null | undefined): string {
  if (!id) return "Zona no informada";
  return RAPA_NUI_ZONE_LABEL[id] ?? "Zona no informada";
}

/** Inferir zona desde texto de origen sin GPS. */
export function inferZoneFromText(originText: string): RapaNuiZoneId | null {
  const t = originText.toLowerCase();
  if (t.includes("mataveri") || t.includes("aeropuerto")) return "mataveri";
  if (t.includes("anakena")) return "anakena";
  if (t.includes("rano raraku")) return "rano_raraku";
  if (t.includes("tongariki")) return "tongariki";
  if (t.includes("orongo") || t.includes("rano kau")) return "rano_kau_orongo";
  if (t.includes("vaihu")) return "vaihu_sur";
  if (t.includes("interior") || t.includes("akivi") || t.includes("puna pau")) return "interior";
  if (
    t.includes("hanga roa") || t.includes("hotel") || t.includes("hospital") ||
    t.includes("municipalidad") || t.includes("tahai") || t.includes("mercado") ||
    t.includes("iglesia") || t.includes("explora") || t.includes("nayara")
  ) return "hanga_roa";
  return null;
}
