Apple Pay — certificado de dominio (Klap)
==========================================

Klap entrega un archivo .txt para certificar el dominio productivo.

1) Guarda el archivo que te envie Klap (adjunto o enlace).

2) Instalalo en el repo (PowerShell, desde la raiz del proyecto):

   .\scripts\release\install-klap-apple-pay-cert.ps1 -CertPath "C:\ruta\al\archivo-de-klap.txt"

   Eso lo copia a:
   apps/mobile/public/.well-known/apple-developer-merchantid-domain-association.txt

3) Rebuild y sube el frontend a Hostinger (api.rapago.cl/public_html).

4) Verifica en el navegador (debe verse texto plano, NO la app React):

   https://api.rapago.cl/.well-known/apple-developer-merchantid-domain-association.txt

5) Responde a Klap con esa URL exacta para que validen Apple Pay.

Google Pay: Klap certifica contra la URL publica del flujo de pago:
   https://api.rapago.cl/passenger/request-ride
