import type { RideRequest, RideStop } from "../../db/schema/index.js";
import type { RideWithDriverName } from "./rides.repository.js";
import type {
  RideRequestResponse,
  RideStopResponse,
  DriverRideResponse,
  AvailableRideResponse,
} from "./rides.types.js";

export function toStopResponse(s: RideStop): RideStopResponse {
  return {
    id:                     s.id,
    rideRequestId:          s.rideRequestId,
    stopOrder:              s.stopOrder,
    label:                  s.label,
    lat:                    s.lat,
    lng:                    s.lng,
    segmentDistanceMeters:  s.segmentDistanceMeters ?? null,
    segmentDurationSeconds: s.segmentDurationSeconds ?? null,
    segmentFareClp:         s.segmentFareClp ?? null,
    arrivedAt:              s.arrivedAt?.toISOString() ?? null,
    completedAt:            s.completedAt?.toISOString() ?? null,
  };
}

export function toResponse(
  r: RideRequest | RideWithDriverName,
  discountInfo?: { discountPercent: number; originalFare: number },
  stops?: RideStopResponse[],
): RideRequestResponse {
  return {
    id:              r.id,
    passengerUserId: r.passengerUserId,
    driverUserId:    r.driverUserId ?? null,
    driverName:      ("driverName"  in r ? r.driverName  : null) ?? null,
    driverPhone:     ("driverPhone" in r ? r.driverPhone : null) ?? null,
    originText:      r.originText,
    destinationText: r.destinationText,
    notes:           r.notes,
    estimatedFareClp:      r.estimatedFareClp ?? null,
    originLat:             r.originLat ?? null,
    originLng:             r.originLng ?? null,
    destinationLat:        r.destinationLat ?? null,
    destinationLng:        r.destinationLng ?? null,
    distanceMeters:        r.distanceMeters ?? null,
    durationSeconds:       r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
    status:          r.status,
    requestedAt:     r.requestedAt.toISOString(),
    acceptedAt:      r.acceptedAt?.toISOString() ?? null,
    enRouteAt:       r.enRouteAt?.toISOString() ?? null,
    arrivedAt:       r.arrivedAt?.toISOString() ?? null,
    startedAt:       r.startedAt?.toISOString() ?? null,
    completedAt:     r.completedAt?.toISOString() ?? null,
    cancelledAt:        r.cancelledAt?.toISOString() ?? null,
    cancellationReason: r.cancellationReason ?? null,
    cancelledByRole:    r.cancelledByRole ?? null,
    createdAt:          r.createdAt.toISOString(),
    updatedAt:          r.updatedAt.toISOString(),
    driverRatingAverage: ("driverRatingAverage" in r ? r.driverRatingAverage : null) ?? null,
    driverRatingCount:   ("driverRatingCount"   in r ? r.driverRatingCount   : 0) ?? 0,
    driverVehicleBrand:  ("driverVehicleBrand"  in r ? r.driverVehicleBrand  : null) ?? null,
    driverVehicleModel:  ("driverVehicleModel"  in r ? r.driverVehicleModel  : null) ?? null,
    driverVehicleYear:   ("driverVehicleYear"   in r ? r.driverVehicleYear   : null) ?? null,
    driverVehiclePlate:  ("driverVehiclePlate"  in r ? r.driverVehiclePlate  : null) ?? null,
    driverVehicleColor:  ("driverVehicleColor"  in r ? r.driverVehicleColor  : null) ?? null,
    discountApplied:  discountInfo != null,
    discountPercent:  discountInfo?.discountPercent ?? null,
    originalFareClp:  discountInfo?.originalFare ?? null,
    rideType:              r.rideType ?? "immediate",
    scheduledPickupAt:     r.scheduledPickupAt?.toISOString() ?? null,
    priorityFeeClp:        r.priorityFeeClp ?? null,
    flightNumber:          r.flightNumber ?? null,
    preferredDriverGender: (r.preferredDriverGender as "female" | null | undefined) ?? null,
    ...(stops ? { stops } : {}),
  };
}

export function toDriverRideResponse(r: RideRequest, stops?: RideStopResponse[]): DriverRideResponse {
  return {
    id:                    r.id,
    originText:            r.originText,
    destinationText:       r.destinationText,
    notes:                 r.notes,
    estimatedFareClp:      r.estimatedFareClp ?? null,
    originLat:             r.originLat ?? null,
    originLng:             r.originLng ?? null,
    destinationLat:        r.destinationLat ?? null,
    destinationLng:        r.destinationLng ?? null,
    distanceMeters:        r.distanceMeters ?? null,
    durationSeconds:       r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
    status:                r.status,
    requestedAt:           r.requestedAt.toISOString(),
    acceptedAt:            r.acceptedAt?.toISOString() ?? null,
    enRouteAt:             r.enRouteAt?.toISOString() ?? null,
    arrivedAt:             r.arrivedAt?.toISOString() ?? null,
    startedAt:             r.startedAt?.toISOString() ?? null,
    completedAt:           r.completedAt?.toISOString() ?? null,
    cancelledAt:           r.cancelledAt?.toISOString() ?? null,
    cancellationReason:    r.cancellationReason ?? null,
    cancelledByRole:       r.cancelledByRole ?? null,
    createdAt:             r.createdAt.toISOString(),
    rideType:              r.rideType ?? "immediate",
    scheduledPickupAt:     r.scheduledPickupAt?.toISOString() ?? null,
    priorityFeeClp:        r.priorityFeeClp ?? null,
    flightNumber:          r.flightNumber ?? null,
    ...(stops && stops.length > 0 ? { stops } : {}),
  };
}

export function toAvailableResponse(r: RideRequest): AvailableRideResponse {
  return {
    id:                    r.id,
    originText:            r.originText,
    destinationText:       r.destinationText,
    notes:                 r.notes,
    estimatedFareClp:      r.estimatedFareClp ?? null,
    distanceMeters:        r.distanceMeters ?? null,
    durationSeconds:       r.durationSeconds ?? null,
    fareCalculationSource: r.fareCalculationSource,
    status:                r.status,
    requestedAt:           r.requestedAt.toISOString(),
    createdAt:             r.createdAt.toISOString(),
  };
}
