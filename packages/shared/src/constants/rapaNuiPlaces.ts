// TODO: agregar coordenadas reales en fase futura con integración Google Maps
export type RapaNuiPlaceCategory =
  | "airport"
  | "town"
  | "hotel"
  | "beach"
  | "tourist_spot"
  | "port"
  | "health"
  | "public_service"
  | "custom_reference";

export interface RapaNuiPlace {
  id: string;
  name: string;
  category: RapaNuiPlaceCategory;
  area: string;
  addressHint?: string;
  lat: number | null;
  lng: number | null;
  isPopular: boolean;
  sortOrder: number;
}

export const RAPA_NUI_PLACES: RapaNuiPlace[] = [
  {
    id: "airport_mataveri",
    name: "Aeropuerto Mataveri",
    category: "airport",
    area: "Mataveri",
    addressHint: "Av. Hotu Matu'a s/n",
    lat: null,
    lng: null,
    isPopular: true,
    sortOrder: 1,
  },
  {
    id: "hanga_roa_centro",
    name: "Hanga Roa Centro",
    category: "town",
    area: "Hanga Roa",
    addressHint: "Sector central de la ciudad",
    lat: null,
    lng: null,
    isPopular: true,
    sortOrder: 2,
  },
  {
    id: "hospital_hanga_roa",
    name: "Hospital Hanga Roa",
    category: "health",
    area: "Hanga Roa",
    addressHint: "Av. Simón Paoa s/n",
    lat: null,
    lng: null,
    isPopular: true,
    sortOrder: 3,
  },
  {
    id: "municipalidad_rapa_nui",
    name: "Municipalidad de Rapa Nui",
    category: "public_service",
    area: "Hanga Roa",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 4,
  },
  {
    id: "caleta_hanga_piko",
    name: "Caleta Hanga Piko",
    category: "port",
    area: "Hanga Roa",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 5,
  },
  {
    id: "playa_anakena",
    name: "Playa Anakena",
    category: "beach",
    area: "Anakena",
    lat: null,
    lng: null,
    isPopular: true,
    sortOrder: 6,
  },
  {
    id: "ahu_tongariki",
    name: "Ahu Tongariki",
    category: "tourist_spot",
    area: "Tongariki",
    lat: null,
    lng: null,
    isPopular: true,
    sortOrder: 7,
  },
  {
    id: "rano_raraku",
    name: "Rano Raraku",
    category: "tourist_spot",
    area: "Rano Raraku",
    lat: null,
    lng: null,
    isPopular: true,
    sortOrder: 8,
  },
  {
    id: "orongo",
    name: "Orongo",
    category: "tourist_spot",
    area: "Rano Kau",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 9,
  },
  {
    id: "tahai",
    name: "Tahai",
    category: "tourist_spot",
    area: "Hanga Roa",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 10,
  },
  {
    id: "ahu_akivi",
    name: "Ahu Akivi",
    category: "tourist_spot",
    area: "Interior",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 11,
  },
  {
    id: "vinapu",
    name: "Vinapu",
    category: "tourist_spot",
    area: "Sur",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 12,
  },
  {
    id: "puna_pau",
    name: "Puna Pau",
    category: "tourist_spot",
    area: "Interior",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 13,
  },
  {
    id: "mercado_artesanal",
    name: "Mercado Artesanal",
    category: "town",
    area: "Hanga Roa",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 14,
  },
  {
    id: "iglesia_santa_cruz",
    name: "Iglesia Santa Cruz",
    category: "custom_reference",
    area: "Hanga Roa",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 15,
  },
  {
    id: "hotel_hanga_roa_eco",
    name: "Hotel Hanga Roa Eco Village",
    category: "hotel",
    area: "Hanga Roa",
    lat: null,
    lng: null,
    isPopular: true,
    sortOrder: 16,
  },
  {
    id: "explora_rapa_nui",
    name: "Explora Rapa Nui",
    category: "hotel",
    area: "Hanga Roa",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 17,
  },
  {
    id: "nayara_hangaroa",
    name: "Nayara Hangaroa",
    category: "hotel",
    area: "Hanga Roa",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 18,
  },
  {
    id: "sector_vaihu",
    name: "Sector Vaihu",
    category: "custom_reference",
    area: "Sur",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 19,
  },
  {
    id: "sector_mataveri",
    name: "Sector Mataveri",
    category: "custom_reference",
    area: "Mataveri",
    lat: null,
    lng: null,
    isPopular: false,
    sortOrder: 20,
  },
];

export function getPopularPlaces(): RapaNuiPlace[] {
  return RAPA_NUI_PLACES.filter(p => p.isPopular).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findPlaceById(id: string): RapaNuiPlace | undefined {
  return RAPA_NUI_PLACES.find(p => p.id === id);
}

export const RAPA_NUI_PLACE_CATEGORY_LABEL: Record<RapaNuiPlaceCategory, string> = {
  airport: "Aeropuerto",
  town: "Zona urbana",
  hotel: "Hotel",
  beach: "Playa",
  tourist_spot: "Sitio turístico",
  port: "Puerto / Caleta",
  health: "Salud",
  public_service: "Servicio público",
  custom_reference: "Referencia",
};
