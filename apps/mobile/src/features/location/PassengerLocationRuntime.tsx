import { useEffect, useRef } from "react";
import { useAuth } from "../auth/index.js";
import { ridesService, type RideRequestData } from "../rides/rides.service.js";
import { rideLocationService } from "./rideLocation.service.js";
import type { RideLocationPointResponse } from "./location.types.js";

const ACTIVE_STATUSES = new Set([
  "accepted",
  "driver_en_route",
  "driver_arrived",
  "in_progress",
]);
const LIVE_LOCATION_KEY = "rapago_driver_live_locations_v1";
const CURRENT_LOCATION_KEY = "rapago_current_driver_location";
const LIVE_LOCATION_EVENT = "rapago:driver-live-location-updated";

function activeRideOf(rides: RideRequestData[]): RideRequestData | null {
  return (
    rides
      .filter((ride) => Boolean(ride.driverUserId) && ACTIVE_STATUSES.has(String(ride.status)))
      .sort((a, b) => {
        const bTime = new Date(b.startedAt ?? b.acceptedAt ?? b.createdAt).getTime();
        const aTime = new Date(a.startedAt ?? a.acceptedAt ?? a.createdAt).getTime();
        return bTime - aTime;
      })[0] ?? null
  );
}

function persist(ride: RideRequestData, point: RideLocationPointResponse): void {
  const payload = {
    rideId: ride.id,
    lat: point.lat,
    lng: point.lng,
    heading: point.headingDegrees,
    speed: point.speedMetersPerSecond,
    accuracy: point.accuracyMeters,
    updatedAt: point.capturedAt,
    source: point.source,
    appState: point.appState,
    status: ride.status,
    driverName: ride.driverName,
    driverPhone: ride.driverPhone,
    driverVehicleBrand: ride.driverVehicleBrand,
    driverVehicleModel: ride.driverVehicleModel,
    driverVehicleYear: ride.driverVehicleYear,
    driverVehiclePlate: ride.driverVehiclePlate,
    driverVehicleColor: ride.driverVehicleColor,
    vehicleBrand: ride.driverVehicleBrand,
    vehicleModel: ride.driverVehicleModel,
    vehiclePlate: ride.driverVehiclePlate,
    vehicleColor: ride.driverVehicleColor,
    originText: ride.originText,
    destinationText: ride.destinationText,
  };

  try {
    const raw = sessionStorage.getItem(LIVE_LOCATION_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    const map = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
    map[ride.id] = payload;
    sessionStorage.setItem(LIVE_LOCATION_KEY, JSON.stringify(map));
    sessionStorage.setItem(CURRENT_LOCATION_KEY, JSON.stringify(payload));
  } catch {
    // Los eventos siguen actualizando la UI aunque sessionStorage falle.
  }

  window.dispatchEvent(new CustomEvent(LIVE_LOCATION_EVENT, { detail: payload }));
}

export function PassengerLocationRuntime(): null {
  const { session } = useAuth();
  const rideRef = useRef<RideRequestData | null>(null);
  const token = session?.accessToken ?? null;
  const role = String(session?.user?.role ?? "");

  useEffect(() => {
    if (!token || (role !== "passenger" && role !== "driver")) {
      rideRef.current = null;
      return;
    }

    let cancelled = false;
    const loadRide = async () => {
      try {
        const rides = await ridesService.listMyRides(token);
        if (!cancelled) rideRef.current = activeRideOf(rides);
      } catch {
        if (!cancelled) rideRef.current = null;
      }
    };

    void loadRide();
    const rideTimer = window.setInterval(() => void loadRide(), 7000);
    const onRideUpdate = () => void loadRide();
    window.addEventListener("rapago:passenger-rides-updated", onRideUpdate);

    const locationTimer = window.setInterval(() => {
      const ride = rideRef.current;
      if (!ride) return;
      void rideLocationService.latest(token, ride.id).then((point) => {
        if (!cancelled && point) persist(ride, point);
      }).catch(() => {
        // Mantiene el último punto válido mientras se recupera la conexión.
      });
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(rideTimer);
      window.clearInterval(locationTimer);
      window.removeEventListener("rapago:passenger-rides-updated", onRideUpdate);
    };
  }, [role, token]);

  return null;
}
