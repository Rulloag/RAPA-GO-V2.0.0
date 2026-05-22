import type { FastifyInstance } from "fastify";
import { rentalController } from "./rental.controller.js";

export async function rentalRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/rental-operator/me/vehicles",                    rentalController.getMyVehicles);
  fastify.post("/rental-operator/me/vehicles",                   rentalController.createVehicle);
  fastify.patch("/rental-operator/me/vehicles/:id",              rentalController.updateVehicle);
  fastify.patch("/rental-operator/me/vehicles/:id/status",       rentalController.updateVehicleStatus);
  fastify.get("/rental-operator/me/bookings",                    rentalController.getMyOperatorBookings);
  fastify.patch("/rental-operator/me/bookings/:id/confirm",      rentalController.confirmBooking);
  fastify.patch("/rental-operator/me/bookings/:id/complete",     rentalController.completeBooking);
  fastify.patch("/rental-operator/me/bookings/:id/cancel",       rentalController.cancelOperatorBooking);

  fastify.get("/rental-vehicles",                                rentalController.listAvailableVehicles);
  fastify.get("/rental-vehicles/:id",                            rentalController.getVehicle);
  fastify.post("/rental-bookings",                               rentalController.createRentalBooking);
  fastify.get("/rental-bookings/me",                             rentalController.getMyRentalBookings);
  fastify.patch("/rental-bookings/:id/cancel",                   rentalController.cancelRentalBooking);
}
