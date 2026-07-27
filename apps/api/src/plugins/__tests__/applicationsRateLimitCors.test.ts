import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import Fastify, {
  type FastifyInstance,
} from "fastify";
import cors from "@fastify/cors";
import { createCorsOptions } from "../cors.js";
import { rateLimitPlugin } from "../rateLimit.js";
import { globalErrorHandler } from "../../shared/errors/errorHandler.js";

const ALLOWED_ORIGIN = "https://api.rapago.cl";

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, createCorsOptions());
  await app.register(rateLimitPlugin);

  app.setErrorHandler(globalErrorHandler);

  app.post(
    "/applications-test",
    {
      config: {
        rateLimit: {
          max: 1,
          timeWindow: "1 minute",
        },
      },
    },
    async () => ({
      ok: true,
    }),
  );

  await app.ready();

  return app;
}

describe(
  "applications rate limit preserves CORS",
  () => {
    let app: FastifyInstance;

    beforeEach(async () => {
      app = await buildTestApp();
    });

    afterEach(async () => {
      await app.close();
    });

    it(
      "returns CORS headers when the limit is exceeded",
      async () => {
        const firstResponse = await app.inject({
          method: "POST",
          url: "/applications-test",
          headers: {
            origin: ALLOWED_ORIGIN,
          },
        });

        expect(firstResponse.statusCode).toBe(200);

        const limitedResponse = await app.inject({
          method: "POST",
          url: "/applications-test",
          headers: {
            origin: ALLOWED_ORIGIN,
          },
        });

        expect(limitedResponse.statusCode).toBe(429);

        expect(
          limitedResponse.headers[
            "access-control-allow-origin"
          ],
        ).toBe(ALLOWED_ORIGIN);

        expect(
          limitedResponse.headers[
            "access-control-allow-credentials"
          ],
        ).toBe("true");
      },
    );
  },
);