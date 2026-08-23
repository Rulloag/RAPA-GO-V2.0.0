# RAPA GO — Despliegue Klap Elements (Apple Pay / Google Pay)

**Fecha:** 18 de agosto de 2026  
**Rama GitHub:** `facture/leandro-ui`  
**Comercio:** RAPA GO — Rapa Nui, Chile

---

## 1. URLs e infraestructura

| Rol | URL pública | Servidor Hostinger |
|-----|-------------|-------------------|
| **Frontend (app pasajero)** | https://api.rapago.cl | SSH: `u269513748@212.85.6.237` puerto **65002** |
| **Backend (API Node)** | https://backend.rapago.cl/api | Panel Hostinger → Node.js (redesplegar rama) |
| **Carpeta frontend** | — | `~/domains/api.rapago.cl/public_html` |

**IP SSH Hostinger:** `212.85.6.237`  
**Usuario SSH:** `u269513748`

---

## 2. Certificación Apple Pay (respuesta a Klap)

Klap debe validar el certificado en esta URL **exacta**:

```
https://api.rapago.cl/.well-known/apple-developer-merchantid-domain-association.txt
```

**Importante:** el archivo lo entrega Klap. Debe verse como **texto plano** en el navegador (no la app React ni pantalla “Checking your browser”).

### Instalar certificado (cuando Klap lo envíe)

```powershell
cd C:\Users\leand\Desktop\Rapa_Go
.\scripts\release\install-klap-apple-pay-cert.ps1 -CertPath "C:\ruta\archivo-klap.txt"
npm run build --workspace=apps/mobile
# Generar ZIP y subir a public_html
```

---

## 3. Certificación Google Pay (respuesta a Klap)

URL pública del flujo de pago:

```
https://api.rapago.cl/passenger/request-ride
```

---

## 4. Variables de entorno

### Frontend (build — `apps/mobile/.env.production`)

```env
VITE_API_BASE_URL=https://backend.rapago.cl/api
VITE_KLAP_ELEMENTS_ENABLED=true
VITE_KLAP_CHECKOUT_FLEX_SCRIPT_URL=https://klap.cl/pagos/checkout-flex/v1/main.min.js
```

### Backend (Hostinger Node — `backend.rapago.cl`)

```env
KLAP_DISABLE_WALLETS=false
KLAP_WEBHOOK_VALIDATION_URL=https://backend.rapago.cl/api/webhooks/klap/validate
KLAP_RETURN_URL=https://api.rapago.cl/passenger/trips?payment=return
KLAP_CANCEL_URL=https://api.rapago.cl/passenger/trips?payment=failure_return
```

---

## 5. Subir frontend (ZIP)

### PowerShell (PC → servidor)

```powershell
scp -P 65002 "C:\Users\leand\Desktop\Rapa_Go\release-zips\rapago-frontend-YYYYMMDD-HHMMSS.zip" u269513748@212.85.6.237:~/
```

### SSH (dentro del servidor)

```bash
ssh -p 65002 u269513748@212.85.6.237
cd ~/domains/api.rapago.cl/public_html
unzip -o ~/rapago-frontend-YYYYMMDD-HHMMSS.zip
```

Probar en incógnito: https://api.rapago.cl/passenger/request-ride

---

## 6. Texto sugerido — email a Klap (Tomás Jiménez)

> Hola Tomás,
>
> Integración Klap Elements según manual.
>
> **Certificado Apple Pay:**  
> https://api.rapago.cl/.well-known/apple-developer-merchantid-domain-association.txt
>
> **Flujo de pago (Google Pay):**  
> https://api.rapago.cl/passenger/request-ride
>
> **Dominios:** api.rapago.cl (frontend) · backend.rapago.cl (API)
>
> Quedamos atentos a la validación de certificación.
>
> Saludos,  
> Leandro — RAPA GO

---

## 7. Qué cambió en código

- Klap Elements: `KLAP_FLEX.initWallets` con Apple Pay y Google Pay
- Modal de pago con billeteras + tarjeta (redirect Klap)
- `.htaccess` sirve `/.well-known/` sin redirigir al SPA
- Documentación: `docs/KLAP_ELEMENTS.md`

---

*Generado automáticamente — RAPA GO / facture/leandro-ui*
