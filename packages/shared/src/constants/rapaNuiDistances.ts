export const BASE_FARE_PER_KM_CLP = 2_300;
export const BASE_FARE_MIN_CLP    = 3_000;

export interface RouteDistance {
  from:    string;
  to:      string;
  km:      number;
  minutes: number;
}

export const RAPA_NUI_DISTANCES: RouteDistance[] = [
  // Airport ↔ Hanga Roa
  { from: "airport_mataveri",    to: "hanga_roa_centro",    km: 2,  minutes: 5  },
  { from: "airport_mataveri",    to: "sector_mataveri",     km: 1,  minutes: 3  },
  { from: "airport_mataveri",    to: "hospital_hanga_roa",  km: 3,  minutes: 7  },
  { from: "airport_mataveri",    to: "hotel_hanga_roa_eco", km: 2,  minutes: 5  },
  { from: "airport_mataveri",    to: "nayara_hangaroa",     km: 2,  minutes: 5  },
  { from: "airport_mataveri",    to: "explora_rapa_nui",    km: 2,  minutes: 5  },

  // Hanga Roa ↔ Tourist sites
  { from: "hanga_roa_centro",    to: "playa_anakena",       km: 22, minutes: 28 },
  { from: "hanga_roa_centro",    to: "ahu_tongariki",       km: 25, minutes: 30 },
  { from: "hanga_roa_centro",    to: "rano_raraku",         km: 18, minutes: 22 },
  { from: "hanga_roa_centro",    to: "orongo",              km: 8,  minutes: 12 },
  { from: "hanga_roa_centro",    to: "ahu_akivi",           km: 10, minutes: 15 },
  { from: "hanga_roa_centro",    to: "puna_pau",            km: 6,  minutes: 10 },
  { from: "hanga_roa_centro",    to: "tahai",               km: 2,  minutes: 5  },
  { from: "hanga_roa_centro",    to: "vinapu",              km: 5,  minutes: 8  },
  { from: "hanga_roa_centro",    to: "sector_vaihu",        km: 12, minutes: 16 },
  { from: "hanga_roa_centro",    to: "caleta_hanga_piko",   km: 3,  minutes: 6  },
  { from: "hanga_roa_centro",    to: "hospital_hanga_roa",  km: 1,  minutes: 3  },
  { from: "hanga_roa_centro",    to: "municipalidad_rapa_nui", km: 1, minutes: 3 },
  { from: "hanga_roa_centro",    to: "mercado_artesanal",   km: 1,  minutes: 3  },
  { from: "hanga_roa_centro",    to: "iglesia_santa_cruz",  km: 1,  minutes: 3  },

  // Cross-island
  { from: "playa_anakena",       to: "ahu_tongariki",       km: 15, minutes: 20 },
  { from: "playa_anakena",       to: "rano_raraku",         km: 12, minutes: 16 },
  { from: "rano_raraku",         to: "ahu_tongariki",       km: 5,  minutes: 8  },
  { from: "rano_raraku",         to: "sector_vaihu",        km: 8,  minutes: 12 },
  { from: "orongo",              to: "vinapu",              km: 6,  minutes: 9  },
  { from: "ahu_akivi",           to: "puna_pau",            km: 5,  minutes: 8  },

  // Hotels
  { from: "hotel_hanga_roa_eco", to: "playa_anakena",       km: 22, minutes: 28 },
  { from: "explora_rapa_nui",    to: "ahu_tongariki",       km: 24, minutes: 30 },
  { from: "nayara_hangaroa",     to: "rano_raraku",         km: 17, minutes: 22 },
];

function canonical(id: string): string {
  return id.trim().toLowerCase().replace(/\s+/g, "_");
}

export function getDistanceBetween(
  originId: string,
  destId:   string,
): { km: number; minutes: number } | null {
  const o = canonical(originId);
  const d = canonical(destId);
  if (o === d) return { km: 0, minutes: 0 };

  const direct = RAPA_NUI_DISTANCES.find(
    (r) => (r.from === o && r.to === d) || (r.from === d && r.to === o),
  );
  if (direct) return { km: direct.km, minutes: direct.minutes };

  return null;
}

export function getEstimatedFare(km: number): number {
  const raw = Math.ceil(km) * BASE_FARE_PER_KM_CLP;
  return Math.max(raw, BASE_FARE_MIN_CLP);
}
