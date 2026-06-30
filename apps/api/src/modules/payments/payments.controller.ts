import type { FastifyReply, FastifyRequest } from "fastify";
import { prontoPagaService } from "./prontopaga.service.js";

type CreateProntoPagaBody = {
  rideId: string;
  amountClp: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocument: string;
};

type DemoCheckoutQuery = {
  order?: string;
  amount?: string;
  currency?: string;
};

export const paymentsController = {
  async createProntoPaga(
    request: FastifyRequest<{ Body: CreateProntoPagaBody }>,
    reply: FastifyReply,
  ): Promise<void> {
    try {
      const payment = await prontoPagaService.createPayment(request.body);

      reply.send({
        ok: true,
        data: payment,
      });
    } catch (err) {
      reply.status(400).send({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "No se pudo crear el pago con ProntoPaga.",
      });
    }
  },

  async webhookProntoPaga(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    console.log("Webhook ProntoPaga recibido:", request.body);

    reply.send({
      ok: true,
      received: true,
    });
  },

  async demoCheckout(
    request: FastifyRequest<{ Querystring: DemoCheckoutQuery }>,
    reply: FastifyReply,
  ): Promise<void> {
    const order = request.query.order ?? "RAPAGO-DEMO";
    const amount = Number(request.query.amount ?? 0);
    const currency = request.query.currency ?? "CLP";

    const finalUrl =
      process.env["PRONTOPAGA_URL_FINAL"] ??
      "http://localhost:5173/passenger/trips";

    const rejectedUrl =
      process.env["PRONTOPAGA_URL_REJECTED"] ??
      "http://localhost:5173/passenger/request-ride";

    reply.type("text/html").send(`
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ProntoPaga Demo - Rapa Go</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      background: #111;
      color: #111;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }

    .card {
      width: 100%;
      max-width: 420px;
      background: #fff;
      border-radius: 24px;
      padding: 22px;
      box-shadow: 0 20px 60px rgba(0,0,0,.45);
    }

    h1 {
      margin: 0 0 4px;
      font-size: 25px;
      font-weight: 900;
    }

    .sub {
      margin: 0 0 18px;
      color: #666;
      font-size: 14px;
    }

    .amount {
      background: linear-gradient(135deg, #f7d774, #d4a62a);
      border-radius: 18px;
      padding: 16px;
      font-weight: 900;
      font-size: 24px;
      margin: 16px 0;
    }

    label {
      display: block;
      font-size: 13px;
      font-weight: 800;
      margin: 12px 0 6px;
    }

    input {
      width: 100%;
      box-sizing: border-box;
      padding: 14px;
      border-radius: 14px;
      border: 1px solid #ddd;
      font-size: 16px;
      font-weight: 700;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    button {
      width: 100%;
      border: 0;
      border-radius: 16px;
      padding: 15px;
      font-weight: 900;
      font-size: 16px;
      margin-top: 14px;
      cursor: pointer;
    }

    .pay {
      background: #2469C9;
      color: #fff;
    }

    .cancel {
      background: #eee;
      color: #111;
    }

    .note {
      margin-top: 14px;
      font-size: 12px;
      color: #666;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>ProntoPaga Demo</h1>
    <p class="sub">Pantalla de prueba local para RAPA GO.</p>

    <div class="amount">
      $${Math.round(amount).toLocaleString("es-CL")} ${currency}
    </div>

    <label>Número de tarjeta</label>
    <input value="4242 4242 4242 4242" />

    <div class="grid">
      <div>
        <label>Vencimiento</label>
        <input value="12/29" />
      </div>
      <div>
        <label>CVV</label>
        <input value="123" />
      </div>
    </div>

    <label>Nombre</label>
    <input value="Cliente Rapa Go" />

    <button class="pay" onclick="location.href='${finalUrl}?order=${encodeURIComponent(order)}&status=success'">
      Pagar demo
    </button>

    <button class="cancel" onclick="location.href='${rejectedUrl}?order=${encodeURIComponent(order)}&status=rejected'">
      Rechazar demo
    </button>

    <p class="note">
      Esta pantalla aparece porque estás usando token demo. Con credenciales reales sandbox de ProntoPaga, aquí se abrirá la pantalla real del banco/tarjeta.
    </p>
  </div>
</body>
</html>
    `);
  },
};