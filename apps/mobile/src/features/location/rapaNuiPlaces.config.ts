/**
 * Catálogo central de POIs de Rapa Nui con coordenadas verificadas (OSM / fuentes
 * locales). Toda búsqueda, autocomplete y selección en mapa debe preferir estos
 * puntos frente a resultados genéricos de Google fuera de contexto.
 */
export type RapaNuiLocalPlace = {
  id: string;
  name: string;
  subtitle: string;
  address: string;
  lat: number;
  lng: number;
  aliases: readonly string[];
  placeTypes: readonly string[];
};

export const RAPA_NUI_LOCAL_PLACE_PREFIX = "rapago-local:" as const;

/** Centro operativo de Hanga Roa. */
export const RAPA_NUI_MAP_CENTER = {
  lat: -27.1505,
  lng: -109.4325,
} as const;

export const RAPA_NUI_LOCAL_PLACES: readonly RapaNuiLocalPlace[] = [
  {
    id: "hospital-hanga-roa",
    name: "Hospital de Hanga Roa",
    subtitle: "Salud y urgencias",
    address: "Hospital Hanga Roa, Ana o Rohi, Mataveri, Hanga Roa, Rapa Nui",
    lat: -27.15052,
    lng: -109.42094,
    aliases: [
      "hospital",
      "hosp",
      "urgencia",
      "urgencias",
      "salud",
      "hanga roa hospital",
    ],
    placeTypes: ["hospital", "health", "point_of_interest", "establishment"],
  },
  {
    id: "aeropuerto-mataveri",
    name: "Aeropuerto Internacional Mataveri",
    subtitle: "Terminal de pasajeros",
    address:
      "Aeropuerto Internacional Mataveri, Atamu Te Kena, Mataveri, Hanga Roa",
    lat: -27.16467,
    lng: -109.42133,
    aliases: [
      "aero",
      "aeropuerto",
      "airport",
      "mataveri",
      "terminal",
      "dgac",
      "aeronautica",
      "aeronautica civil",
    ],
    placeTypes: ["airport", "point_of_interest", "establishment"],
  },
  {
    id: "ahu-tahai",
    name: "Ahu Tahai",
    subtitle: "Cultura y atardecer",
    address: "Ahu Tahai, Tahai, Hanga Roa, Rapa Nui, Chile",
    lat: -27.1395,
    lng: -109.42693,
    /* Sin alias cortos ("tah"): "Hotel Taha Tai" contenía "tah" y el pin
       saltaba al Ahu. Solo nombres/alias inequívocos. */
    aliases: ["tahai", "ahu tahai", "atardecer tahai"],
    placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
  },
  {
    id: "playa-pea",
    name: "Playa Pea",
    subtitle: "Playa y zona céntrica",
    address: "Playa Pea, Mataveri, Hanga Roa, Rapa Nui, Chile",
    lat: -27.14804,
    lng: -109.43093,
    aliases: ["pea", "playa pea", "playa", "centro"],
    placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
  },
  {
    id: "playa-poko-poko",
    name: "Playa Poko Poko",
    subtitle: "Costa y paseo familiar",
    address: "Playa Poko Poko, Hanga Roa, Rapa Nui, Chile",
    lat: -27.1478,
    lng: -109.4315,
    aliases: ["poko", "poko poko", "playa poko", "playa poko poko"],
    placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
  },
  {
    id: "mercado-artesanal",
    name: "Mercado Artesanal Rapa Nui",
    subtitle: "Artesanía local",
    address: "Mercado Artesanal, Petero Atamu, Hanga Roa, Rapa Nui, Chile",
    lat: -27.1493,
    lng: -109.4245,
    aliases: [
      "mercado",
      "artesania",
      "artesanía",
      "mercado artesanal",
      "souvenir",
    ],
    placeTypes: ["market", "store", "point_of_interest", "establishment"],
  },
  {
    id: "feria-hare-umanga",
    name: "Feria Artesanal Hare Umanga",
    subtitle: "Feria y recuerdos",
    address: "Feria Hare Umanga, Tu'u Maheke, Mataveri, Hanga Roa, Rapa Nui",
    lat: -27.14945,
    lng: -109.42918,
    /* Sin alias suelto "hare": confundía búsquedas de hoteles (Hare Nua,
       Hare Uta, Maea Hare…). La feria se encuentra por "feria" / "umanga". */
    aliases: [
      "feria",
      "feria hare",
      "hare umanga",
      "feria umanga",
      "feria artesanal",
      "feria artesanal hare umanga",
    ],
    placeTypes: ["market", "store", "point_of_interest", "establishment"],
  },
  {
    id: "hotel-taha-tai",
    name: "Hotel Taha Tai",
    subtitle: "Hotel · Apina, Hanga Roa",
    address: "Apina Nui s/n, Hanga Roa, Rapa Nui, Chile",
    lat: -27.14972,
    lng: -109.43694,
    aliases: [
      "taha tai",
      "hotel taha tai",
      "taha tai hotel",
      "tahatai",
      "hotel tahatai",
    ],
    placeTypes: ["lodging", "hotel", "point_of_interest", "establishment"],
  },
  {
    id: "hotel-hare-nua",
    name: "Hotel Hare Nua",
    subtitle: "Hotel · Atamu Tekena",
    address: "Atamu Tekena, Hanga Roa, Rapa Nui, Chile",
    lat: -27.15025,
    lng: -109.42745,
    aliases: ["hare nua", "hotel hare nua", "harenua"],
    placeTypes: ["lodging", "hotel", "point_of_interest", "establishment"],
  },
  {
    id: "hare-rapa-nui-hotel",
    name: "Hare Rapa Nui Hotel by Chez Joseph",
    subtitle: "Hotel · Hanga Roa",
    address: "Hanga Roa, Rapa Nui, Chile",
    lat: -27.14855,
    lng: -109.43035,
    aliases: [
      "hare rapa nui",
      "hare rapa nui hotel",
      "chez joseph",
      "hotel chez joseph",
    ],
    placeTypes: ["lodging", "hotel", "point_of_interest", "establishment"],
  },
  {
    id: "hotel-hare-uta",
    name: "Hotel Hare Uta",
    subtitle: "Hotel · Hanga Roa",
    address: "Hanga Roa, Rapa Nui, Chile",
    lat: -27.15265,
    lng: -109.42855,
    aliases: ["hare uta", "hotel hare uta", "hareuta"],
    placeTypes: ["lodging", "hotel", "point_of_interest", "establishment"],
  },
  {
    id: "hotel-maea-hare-repa",
    name: "Hotel Maea Hare Repa",
    subtitle: "Hotel · Sebastián Englert",
    address: "Sebastián Englert, Hanga Roa, Isla de Pascua, Chile",
    lat: -27.14785,
    lng: -109.43175,
    aliases: [
      "maea hare",
      "maea hare repa",
      "hotel maea",
      "hotel maea hare",
      "hotel maea hare repa",
    ],
    placeTypes: ["lodging", "hotel", "point_of_interest", "establishment"],
  },
  {
    id: "caleta-hanga-roa",
    name: "Caleta Hanga Roa",
    subtitle: "Puerto y restaurantes",
    address: "Caleta Hanga Roa, Hanga Roa, Rapa Nui, Chile",
    lat: -27.1472,
    lng: -109.436,
    aliases: ["caleta", "puerto", "caleta hanga roa", "restaurantes"],
    placeTypes: ["point_of_interest", "establishment"],
  },
  {
    id: "comisaria-rapa-nui",
    name: "Comisaría Rapa Nui",
    subtitle: "Carabineros y seguridad",
    address: "Manutara, Mataveri, Hanga Roa, Rapa Nui, Chile",
    lat: -27.16073,
    lng: -109.43719,
    aliases: [
      "comisaria",
      "comisaría",
      "carabineros",
      "policia",
      "policía",
      "seguridad",
    ],
    placeTypes: ["police", "point_of_interest", "establishment"],
  },
  {
    id: "carcel-artesanias",
    name: "Cárcel Rapa Nui (Artesanías)",
    subtitle: "Artesanía y punto de encuentro",
    address: "Mataveri s/n, detrás de Comisaría, Hanga Roa, Rapa Nui, Chile",
    lat: -27.161,
    lng: -109.4365,
    aliases: [
      "carcel",
      "cárcel",
      "artesanias carcel",
      "artesanías cárcel",
      "prison crafts",
    ],
    placeTypes: ["point_of_interest", "establishment", "store"],
  },
  {
    id: "iglesia-santa-cruz",
    name: "Iglesia de la Santa Cruz Rapa Nui",
    subtitle: "Iglesia principal",
    address: "Iglesia de la Santa Cruz, Tu'u Ko Ihu, Mataveri, Hanga Roa",
    lat: -27.14913,
    lng: -109.42425,
    aliases: ["iglesia", "santa cruz", "iglesia santa cruz", "misa"],
    placeTypes: [
      "church",
      "place_of_worship",
      "point_of_interest",
      "establishment",
    ],
  },
  {
    id: "ahu-huri-a-urenga",
    name: "Ahu Huri A Urenga",
    subtitle: "Moai de 4 manos",
    address: "Ahu Huri A Urenga, Pia Taro, Hanga Roa, Rapa Nui, Chile",
    lat: -27.15472,
    lng: -109.40127,
    aliases: ["huri", "huri a urenga", "ahu huri", "moai 4 manos"],
    placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
  },
  {
    id: "jardin-taukiani",
    name: "Jardín Botánico TauKiani",
    subtitle: "Naturaleza y visita",
    address: "Jardín Botánico Tau Kiani, Kai Heke, Hanga Roa, Rapa Nui, Chile",
    lat: -27.14117,
    lng: -109.4115,
    aliases: [
      "jardin",
      "jardín",
      "botanico",
      "botánico",
      "taukiani",
      "jardin botanico",
    ],
    placeTypes: [
      "park",
      "tourist_attraction",
      "point_of_interest",
      "establishment",
    ],
  },
  {
    id: "anakena",
    name: "Anakena",
    subtitle: "Playa y experiencia",
    address: "Playa Anakena, Rapa Nui, Chile",
    lat: -27.07381,
    lng: -109.323,
    aliases: ["anakena", "playa anakena"],
    placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
  },
  {
    id: "terevaka",
    name: "Terevaka",
    subtitle: "Cerro y excursión",
    address: "Maunga Terevaka, Rapa Nui, Chile",
    lat: -27.086,
    lng: -109.38039,
    aliases: ["terevaka", "tere vaka", "cerro", "maunga terevaka"],
    placeTypes: ["tourist_attraction", "point_of_interest", "establishment"],
  },
  {
    id: "cabanas-tahonga",
    name: "Cabañas Tahonga",
    subtitle: "Alojamiento",
    address: "Cabañas Tahonga, Hanga Roa, Rapa Nui, Chile",
    lat: -27.1647,
    lng: -109.4218,
    aliases: ["tahonga", "cabanas tahonga", "cabana tahonga"],
    placeTypes: ["lodging", "point_of_interest", "establishment"],
  },
  {
    id: "casa-silvio",
    name: "Casa Silvio",
    subtitle: "Punto de recogida",
    address: "Casa Silvio, Hanga Roa, Rapa Nui, Chile",
    lat: -27.1478,
    lng: -109.4296,
    aliases: ["silvio", "casa silvio"],
    placeTypes: ["point_of_interest", "establishment"],
  },
  /* ── Calles principales de Hanga Roa (coords OSM, centro de vía) ── */
  {
    id: "calle-atamu-tekena",
    name: "Atamu Tekena",
    subtitle: "Calle principal",
    address: "Atamu Tekena, Hanga Roa, Rapa Nui, Chile",
    lat: -27.14974,
    lng: -109.42915,
    aliases: ["atamu", "tekena", "atamu tekena", "calle atamu"],
    placeTypes: ["route", "geocode"],
  },
  {
    id: "calle-petero-atamu",
    name: "Petero Atamu",
    subtitle: "Calle principal",
    address: "Petero Atamu, Hanga Roa, Rapa Nui, Chile",
    lat: -27.14655,
    lng: -109.42489,
    aliases: ["petero", "petero atamu", "calle petero"],
    placeTypes: ["route", "geocode"],
  },
  {
    id: "calle-manutara",
    name: "Manutara",
    subtitle: "Calle principal",
    address: "Manutara, Hanga Roa, Rapa Nui, Chile",
    lat: -27.16193,
    lng: -109.43835,
    aliases: ["manutara", "calle manutara"],
    placeTypes: ["route", "geocode"],
  },
  {
    id: "calle-mataveri",
    name: "Mataveri",
    subtitle: "Calle principal",
    address: "Mataveri, Hanga Roa, Rapa Nui, Chile",
    lat: -27.16198,
    lng: -109.43715,
    aliases: ["calle mataveri", "mataveri calle"],
    placeTypes: ["route", "geocode"],
  },
  {
    id: "calle-te-pito-o-te-henua",
    name: "Te Pito o Te Henua",
    subtitle: "Calle principal",
    address: "Te Pito o Te Henua, Hanga Roa, Rapa Nui, Chile",
    lat: -27.14803,
    lng: -109.42745,
    aliases: ["te pito", "te henua", "pito henua"],
    placeTypes: ["route", "geocode"],
  },
  {
    id: "calle-policarpo-toro",
    name: "Policarpo Toro",
    subtitle: "Calle principal",
    address: "Policarpo Toro, Hanga Roa, Rapa Nui, Chile",
    lat: -27.14982,
    lng: -109.43483,
    aliases: ["policarpo", "policarpo toro", "toro"],
    placeTypes: ["route", "geocode"],
  },
  {
    id: "calle-hotu-matua",
    name: "Hotu Matu'a",
    subtitle: "Calle principal",
    address: "Hotu Matu'a, Hanga Roa, Rapa Nui, Chile",
    lat: -27.15814,
    lng: -109.42513,
    aliases: ["hotu", "hotu matua", "matua"],
    placeTypes: ["route", "geocode"],
  },
  {
    id: "calle-tuu-maheke",
    name: "Tu'u Maheke",
    subtitle: "Calle principal",
    address: "Tu'u Maheke, Hanga Roa, Rapa Nui, Chile",
    lat: -27.14916,
    lng: -109.43011,
    aliases: ["tuu maheke", "tu'u maheke", "maheke"],
    placeTypes: ["route", "geocode"],
  },
] as const;

/** Atajos visibles en el selector de mapa (recogida y destino). */
export const RAPA_NUI_MAIN_STREET_SUGGESTIONS: readonly {
  name: string;
  subtitle: string;
  search: string;
}[] = [
  {
    name: "Atamu Tekena",
    subtitle: "Calle principal",
    search: "Atamu Tekena Hanga Roa Rapa Nui",
  },
  {
    name: "Petero Atamu",
    subtitle: "Calle principal",
    search: "Petero Atamu Hanga Roa Rapa Nui",
  },
  {
    name: "Manutara",
    subtitle: "Calle principal",
    search: "Manutara Hanga Roa Rapa Nui",
  },
  {
    name: "Mataveri",
    subtitle: "Calle principal",
    search: "Mataveri Hanga Roa Rapa Nui",
  },
  {
    name: "Te Pito o Te Henua",
    subtitle: "Calle principal",
    search: "Te Pito o Te Henua Hanga Roa Rapa Nui",
  },
  {
    name: "Policarpo Toro",
    subtitle: "Calle principal",
    search: "Policarpo Toro Hanga Roa Rapa Nui",
  },
  {
    name: "Hotu Matu'a",
    subtitle: "Calle principal",
    search: "Hotu Matu'a Hanga Roa Rapa Nui",
  },
  {
    name: "Tu'u Maheke",
    subtitle: "Calle principal",
    search: "Tu'u Maheke Hanga Roa Rapa Nui",
  },
];

function normalizePlaceKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isRapaNuiMainStreet(place: RapaNuiLocalPlace): boolean {
  return place.placeTypes.includes("route");
}

export function findLocalRapaNuiPlaceById(
  id: string,
): RapaNuiLocalPlace | null {
  return RAPA_NUI_LOCAL_PLACES.find((place) => place.id === id) ?? null;
}

export function findLocalRapaNuiPlaceByPlaceId(
  placeId: string,
): RapaNuiLocalPlace | null {
  if (!placeId.startsWith(RAPA_NUI_LOCAL_PLACE_PREFIX)) return null;
  return findLocalRapaNuiPlaceById(
    placeId.slice(RAPA_NUI_LOCAL_PLACE_PREFIX.length),
  );
}

function placeKeysMatchStrongly(placeKey: string, queryKey: string): boolean {
  if (!placeKey || !queryKey) return false;
  if (placeKey === queryKey) return true;

  /* Prefijo del nombre completo: "hotel taha" → "hotel taha tai". */
  if (placeKey.startsWith(queryKey) && queryKey.length >= 5) return true;
  if (queryKey.startsWith(placeKey) && placeKey.length >= 5) return true;

  const placeWords = placeKey.split(" ").filter(Boolean);
  const queryWords = queryKey.split(" ").filter(Boolean);
  if (queryWords.length === 0) return false;

  /* Todas las palabras de la consulta aparecen como palabra del nombre
     (o viceversa si la consulta es el nombre completo + ruido tipo "hotel"). */
  const queryCovered = queryWords.every((word) =>
    placeWords.some(
      (placeWord) =>
        placeWord === word ||
        (word.length >= 4 && placeWord.startsWith(word)) ||
        (placeWord.length >= 4 && word.startsWith(placeWord)),
    ),
  );
  if (queryCovered && queryWords.length >= 2) return true;

  if (
    queryWords.length === 1 &&
    queryWords[0]!.length >= 5 &&
    placeWords.some((placeWord) => placeWord === queryWords[0])
  ) {
    return true;
  }

  return false;
}

/**
 * Resuelve un POI local solo con coincidencia fuerte.
 * Nunca usar substrings cortos (p. ej. "tah" dentro de "taha tai"): eso
 * convertía Hotel Taha Tai en Ahu Tahai al confirmar el place_id de Google.
 */
export function findLocalRapaNuiPlaceByName(
  name: unknown,
): RapaNuiLocalPlace | null {
  const key = normalizePlaceKey(name);
  if (!key) return null;

  const exact = RAPA_NUI_LOCAL_PLACES.find((place) => {
    const placeKey = normalizePlaceKey(place.name);
    if (placeKey === key) return true;
    return place.aliases.some((alias) => normalizePlaceKey(alias) === key);
  });
  if (exact) return exact;

  const strong = RAPA_NUI_LOCAL_PLACES.filter((place) => {
    const placeKey = normalizePlaceKey(place.name);
    if (placeKeysMatchStrongly(placeKey, key)) return true;
    return place.aliases.some((alias) =>
      placeKeysMatchStrongly(normalizePlaceKey(alias), key),
    );
  });

  if (strong.length === 1) return strong[0] ?? null;

  /* Si hay varios candidatos fuertes, preferir lodging cuando la consulta
     habla de hotel/hostal/lodge/cabaña. */
  const lodgingIntent =
    /\b(hotel|hostal|lodge|caba|cabana|cabanas)\b/.test(key);
  if (lodgingIntent) {
    const lodging = strong.find((place) =>
      place.placeTypes.some((type) =>
        ["lodging", "hotel", "guest_house"].includes(type),
      ),
    );
    if (lodging) return lodging;
  }

  return null;
}

export function isLodgingPlace(place: RapaNuiLocalPlace): boolean {
  return place.placeTypes.some((type) =>
    ["lodging", "hotel", "guest_house"].includes(type),
  );
}
