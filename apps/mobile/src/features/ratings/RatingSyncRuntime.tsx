import { useEffect } from "react";
import { useAuth } from "../auth/index.js";
import { RatingsApiError, ratingsService } from "./ratings.service.js";

const RATINGS_KEY = "rapago_driver_ratings_v1";
const RATINGS_EVENT = "rapago:driver-ratings-updated";

type LocalRating = Record<string, unknown> & {
  id?: string;
  rideId?: string;
  passengerEmail?: string | null;
  passengerKey?: string;
  stars?: number;
  comment?: string | null;
  backendSyncedAt?: string | null;
};

function readRatings(): LocalRating[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RATINGS_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is LocalRating => Boolean(item && typeof item === "object"))
      : [];
  } catch {
    return [];
  }
}

function writeRatings(items: LocalRating[]): void {
  try {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(items.slice(0, 600)));
    window.dispatchEvent(new CustomEvent(RATINGS_EVENT, { detail: { ratings: items } }));
    window.dispatchEvent(new CustomEvent("rapago:driver-profile-updated", { detail: { ratings: items } }));
  } catch {
    // No bloquea la aplicación.
  }
}

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ""));
}

export function RatingSyncRuntime(): null {
  const { session, user, status } = useAuth();

  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken || !user) return;
    let cancelled = false;

    async function syncDriverSummary(): Promise<void> {
      if (user.role !== "driver") return;
      try {
        const summary = await ratingsService.getMySummary(session.accessToken);
        if (cancelled) return;
        const current = readRatings();
        const driverId = String(user.id ?? "");
        const driverEmail = normalized(user.email);
        const preserved = current.filter((item) => {
          const itemDriverId = normalized(item.driverUserId ?? item.driverId);
          const itemDriverEmail = normalized(item.driverEmail);
          return !(
            (driverId && itemDriverId === normalized(driverId)) ||
            (driverEmail && itemDriverEmail === driverEmail)
          );
        });
        const fromBackend: LocalRating[] = summary.latest.map((item) => ({
          id: item.id,
          rideId: item.rideRequestId,
          rideKey: `ride:${item.rideRequestId}`,
          driverKey: `id:${normalized(driverId)}`,
          driverId,
          driverUserId: driverId,
          driverEmail: user.email,
          driverName: user.name,
          passengerKey: `id:${normalized(item.raterUserId)}`,
          passengerName: item.raterName,
          stars: item.rating,
          comment: item.comment,
          originText: item.originText,
          destinationText: item.destinationText,
          createdAt: item.createdAt,
          backendSyncedAt: item.createdAt,
        }));
        writeRatings([...fromBackend, ...preserved]);
        try {
          localStorage.setItem("rapago_driver_rating_summary_v1", JSON.stringify({ average: summary.average, count: summary.count, updatedAt: new Date().toISOString() }));
        } catch {
          // No bloquea el resumen.
        }
      } catch {
        // El respaldo local sigue visible cuando no hay red.
      }
    }

    async function syncPassengerRatings(): Promise<void> {
      if (user.role !== "passenger" && user.role !== "driver") return;
      const email = normalized(user.email);
      const items = readRatings();
      let changed = false;
      for (const item of items) {
        if (cancelled || item.backendSyncedAt) continue;
        const belongs =
          normalized(item.passengerEmail) === email ||
          normalized(item.passengerKey) === `id:${normalized(user.id)}`;
        if (!belongs || !isUuid(item.rideId)) continue;
        try {
          await ratingsService.rateRide(
            session.accessToken,
            String(item.rideId),
            Math.max(1, Math.min(5, Math.round(Number(item.stars ?? 5)))),
            typeof item.comment === "string" ? item.comment : undefined,
          );
          item.backendSyncedAt = new Date().toISOString();
          changed = true;
        } catch (error) {
          if (error instanceof RatingsApiError && error.code === "RATING_ALREADY_EXISTS") {
            item.backendSyncedAt = new Date().toISOString();
            changed = true;
          }
        }
      }
      if (changed && !cancelled) writeRatings(items);
    }

    void syncDriverSummary();
    void syncPassengerRatings();
    return () => { cancelled = true; };
  }, [session?.accessToken, status, user]);

  return null;
}
