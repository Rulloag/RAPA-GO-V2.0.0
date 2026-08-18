# Klap Elements — Apple Pay y Google Pay

Integración según el manual **Klap Elements** (`checkout-flex`).

## Frontend

Variables en el build del mobile:

```env
VITE_KLAP_ELEMENTS_ENABLED=true
VITE_KLAP_CHECKOUT_FLEX_SCRIPT_URL=https://klap.cl/pagos/checkout-flex/v1/main.min.js
```

Sandbox:

```env
VITE_KLAP_CHECKOUT_FLEX_SCRIPT_URL=https://sandbox.mcdesaqa.cl/pagos/checkout-flex/v1/main.min.js
```

Flujo:

1. El backend crea la orden (`POST /payments/klap/orders`).
2. RAPA GO abre el `redirect_url` de Klap. Apple Pay y Google Pay se pinchan
   ahí (`klap.cl/pagos/order/...`), no en un modal de RAPA GO.
3. `VITE_KLAP_ELEMENTS_ENABLED` queda en `false` por defecto: inyectar Elements
   en nuestra pantalla duplicaba el botón de Google Pay. El código queda listo
   si Klap pide Elements embebido después de entregar el certificado.

## Backend

Habilitar wallets en la orden Klap:

```env
KLAP_DISABLE_WALLETS=false
```

Sin esto, Klap puede ocultar Apple Pay / Google Pay aunque Elements esté cargado.

## Apple Pay — certificado de dominio

Publicar el archivo que entrega Klap en:

```text
https://api.rapago.cl/.well-known/apple-developer-merchantid-domain-association.txt
```

El `.htaccess` del frontend ya excluye `/.well-known/` del fallback SPA.

Apple Pay solo funciona en **Safari** (iPhone/Mac) con Wallet configurado.

## Google Pay

Klap certifica contra una URL pública del flujo de pago. Mantener acceso
público a `https://api.rapago.cl/passenger/request-ride` (o la ruta de pago).

## Validación

```powershell
npm test --workspace=apps/mobile -- --run src/features/payments/__tests__/KlapElements.test.ts src/features/payments/__tests__/KlapCheckoutFrontend.test.ts
```
