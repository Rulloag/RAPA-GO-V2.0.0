/**
 * Centralized route definitions for RAPA GO mobile app.
 *
 * Rules:
 *  - All route path strings live here. Never hardcode paths in pages or layouts.
 *  - ROUTES.X.BASE  — used for prefix matching (<Route path="/passenger">).
 *  - ROUTES.X.*_PATTERN — used for parameterized routes (:id placeholders).
 *  - buildRoute.*  — helpers that return concrete URLs with actual param values.
 */

export const ROUTES = {
  ROOT: "/",
  WELCOME: "/welcome",
  NOT_FOUND: "/404",

  AUTH: {
    BASE: "/auth",
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
  },

  PASSENGER: {
    BASE: "/passenger",
    HOME: "/passenger/home",
    REQUEST_RIDE: "/passenger/request-ride",
    TRIPS: "/passenger/trips",
    TRIP_DETAIL_PATTERN: "/passenger/trips/:tripId",
    GUIDES: "/passenger/guides",
    GUIDE_DETAIL_PATTERN: "/passenger/guides/:guideId",
    RENTALS: "/passenger/rentals",
    RENTAL_DETAIL_PATTERN: "/passenger/rentals/:vehicleId",
    WALLET: "/passenger/wallet",
    PROFILE: "/passenger/profile",
    SERVICE_BOOKINGS: "/passenger/service-bookings",
    EVENTS: "/passenger/events",
    EVENT_TICKETS: "/passenger/event-tickets",
  },

  DRIVER: {
    BASE: "/driver",
    HOME: "/driver/home",
    REQUESTS: "/driver/requests",
    TRIPS: "/driver/trips",
    TRIP_DETAIL_PATTERN: "/driver/trips/:tripId",
    EARNINGS: "/driver/earnings",
    PROFILE: "/driver/profile",
  },

  GUIDE: {
    BASE: "/guide",
    HOME: "/guide/home",
    TOURS: "/guide/tours",
    TOUR_DETAIL_PATTERN: "/guide/tours/:tourId",
    BOOKINGS: "/guide/bookings",
    EARNINGS: "/guide/earnings",
    PROFILE: "/guide/profile",
  },

  RENTAL: {
    BASE: "/rental",
    HOME: "/rental/home",
    VEHICLES: "/rental/vehicles",
    VEHICLE_DETAIL_PATTERN: "/rental/vehicles/:vehicleId",
    BOOKINGS: "/rental/bookings",
    EARNINGS: "/rental/earnings",
    PROFILE: "/rental/profile",
  },

  ADMIN: {
    BASE: "/admin",
    HOME: "/admin/home",
    USERS: "/admin/users",
    DRIVERS: "/admin/drivers",
    GUIDES: "/admin/guides",
    RENTALS: "/admin/rentals",
    TRIPS: "/admin/trips",
    PAYMENTS: "/admin/payments",
    SETTINGS: "/admin/settings",
    DOCUMENTS: "/admin/documents",
    OFFLINE_BOOKINGS: "/admin/offline-bookings",
    APPLICATIONS: "/admin/applications",
    EVENT_TICKETS: "/admin/event-tickets",
    LEGAL_DOCUMENTS: "/admin/legal-documents",
    FARE_SETTINGS: "/admin/fare-settings",
  },

  APPLY: {
    BASE: "/apply",
    DRIVER: "/apply/driver",
    GUIDE: "/apply/guide",
    STATUS: "/apply/status",
  },

  PROFILE: {
    BASE: "/profile",
    INDEX: "/profile",
    DOCUMENTS: "/profile/documents",
    BANK_ACCOUNT: "/profile/bank-account",
    SECURITY: "/profile/security",
    NOTIFICATIONS: "/profile/notifications",
  },
} as const;

/** Build concrete URLs for parameterized routes */
export const buildRoute = {
  passengerTripDetail: (tripId: string): string =>
    `/passenger/trips/${tripId}`,
  passengerGuideDetail: (guideId: string): string =>
    `/passenger/guides/${guideId}`,
  passengerRentalDetail: (vehicleId: string): string =>
    `/passenger/rentals/${vehicleId}`,
  driverTripDetail: (tripId: string): string =>
    `/driver/trips/${tripId}`,
  guideTourDetail: (tourId: string): string =>
    `/guide/tours/${tourId}`,
  rentalVehicleDetail: (vehicleId: string): string =>
    `/rental/vehicles/${vehicleId}`,
};
