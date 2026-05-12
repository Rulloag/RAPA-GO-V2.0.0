# Prueba local del flujo de autenticación — RAPA GO V2.0.0

Guía paso a paso para levantar el backend y probar el flujo auth completo
(register → login → me → logout) en un entorno local. No se requiere app mobile.

---

## Requisitos previos

- Node.js 20+
- PostgreSQL accesible (Supabase, Neon, Railway, local Docker, etc.)
- Las dependencias instaladas: `npm install` desde la raíz del monorepo

---

## 1. Crear `apps/api/.env`

Copia el ejemplo y completa los valores reales (nunca commitear este archivo):

```bash
cp apps/api/.env.example apps/api/.env
```

Edita `apps/api/.env` con los mínimos necesarios para auth:

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173

DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
JWT_SECRET=<genera-uno-con: openssl rand -hex 64>
```

> **Cómo generar JWT_SECRET** (en terminal):
> ```bash
> openssl rand -hex 64
> ```
> Copia el resultado completo. Nunca uses un valor corto o predecible.

---

## 2. Crear `apps/mobile/.env`

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

Edita `apps/mobile/.env`:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_ENV=development
```

---

## 3. Generar y ejecutar migraciones de base de datos

```bash
# Generar SQL de migraciones desde los schemas Drizzle
npm run db:generate -w apps/api

# Aplicar migraciones a la base de datos (requiere DATABASE_URL válido)
npm run db:migrate -w apps/api
```

Las migraciones crean las tablas:
- `users`
- `auth_credentials`
- `auth_sessions`
- `refresh_tokens`
- `audit_events`

---

## 4. Levantar el backend

```bash
npm run dev -w apps/api
```

Deberías ver:
```
{"msg":"Server listening at http://0.0.0.0:3000"}
```

---

## 5. Verificar /health

```bash
curl -s http://localhost:3000/health | python3 -m json.tool
```

Respuesta esperada:
```json
{
  "ok": true,
  "service": "rapa-go-api",
  "version": "2.0.0",
  "status": "healthy",
  "timestamp": "..."
}
```

---

## 6. Pruebas del flujo auth con curl

### 6.1 Registro (passenger)

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@rapago.local",
    "password": "TestPass123!",
    "name": "Usuario Test",
    "role": "passenger"
  }' | python3 -m json.tool
```

Respuesta esperada:
```json
{
  "ok": true,
  "session": {
    "accessToken": "<jwt>",
    "expiresAt": "...",
    "user": {
      "id": "...",
      "email": "test@rapago.local",
      "name": "Usuario Test",
      "role": "passenger",
      "isVerified": false,
      "avatarUrl": null
    }
  }
}
```

> Guarda el valor de `session.accessToken` para los pasos siguientes.

---

### 6.2 Bloqueo de registro admin (debe fallar con 403)

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@rapago.local",
    "password": "AdminPass123!",
    "name": "Admin Attempt",
    "role": "admin"
  }'
```

Resultado esperado: `403`

---

### 6.3 Login

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@rapago.local",
    "password": "TestPass123!"
  }' | python3 -m json.tool
```

Respuesta esperada: igual que register, con `"ok": true` y nuevo `accessToken`.

---

### 6.4 Login con contraseña incorrecta (debe fallar genéricamente)

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@rapago.local",
    "password": "Incorrecta123!"
  }' | python3 -m json.tool
```

Respuesta esperada:
```json
{
  "ok": false,
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid email or password."
}
```

El mensaje no revela si el email existe.

---

### 6.5 GET /api/auth/me (reemplaza TOKEN con el valor obtenido en 6.1 ó 6.3)

```bash
TOKEN="<pega-aqui-el-accessToken>"

curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Respuesta esperada: sesión con datos del usuario.

---

### 6.6 Logout

```bash
curl -s -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Respuesta esperada:
```json
{ "ok": true }
```

---

### 6.7 GET /me después de logout (debe fallar)

```bash
curl -s http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

Respuesta esperada:
```json
{
  "ok": false,
  "code": "AUTH_SESSION_REVOKED",
  "message": "Session has been revoked."
}
```

---

## 7. Levantar mobile (opcional, para prueba UI)

```bash
npm run dev -w apps/mobile
```

Abrir `http://localhost:5173` en el navegador.
Navegar a `/auth/register` o `/auth/login` y probar los formularios.

---

## 8. Verificaciones de seguridad

- [ ] `apps/api/.env` NO aparece en `git status`
- [ ] `apps/mobile/.env` NO aparece en `git status`
- [ ] Los logs del backend NO muestran el valor de `JWT_SECRET`
- [ ] Los logs del backend NO muestran tokens completos
- [ ] El `accessToken` retornado por la API no se almacena en localStorage
- [ ] El registro con `role: "admin"` retorna HTTP 403

---

## 9. Checklist antes de commitear cualquier cambio

```bash
git status   # debe mostrar SOLO archivos intencionados
git diff     # revisar que no haya secretos en diffs
```

Nunca deben aparecer `.env` con valores en `git status`.

---

## Notas

- Las tablas de DB se crean **solo** con `db:migrate`. Sin migración no hay tablas.
- El servidor arranca **sin** `DATABASE_URL` gracias al Lazy DB Proxy, pero cualquier
  llamada a auth fallará con error controlado hasta que la DB esté configurada.
- El servidor arranca **sin** `JWT_SECRET` pero retornará HTTP 503 en cualquier
  endpoint de auth hasta que esté configurado.
