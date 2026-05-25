# Checklist Deploy — Rapa Go v2.0.0

## Antes de subir

- [ ] `DATABASE_URL` de producción configurada en Railway / Supabase / Neon
- [ ] `JWT_SECRET` generado (mínimo 64 bytes aleatorios: `openssl rand -hex 64`)
- [ ] `CORS_ORIGIN` apunta al dominio real del frontend (sin trailing slash)
- [ ] Dominio configurado (rapago.cl o similar)
- [ ] SSL/TLS activo (Railway lo provee automáticamente)
- [ ] `.env` en `.gitignore` (verificar con `git status`)
- [ ] `npm audit` sin vulnerabilidades críticas
- [ ] Supabase Storage buckets creados (ver sección Storage)

## Deploy backend (Railway)

```bash
# 1. Conectar repositorio a Railway y configurar variables de entorno:
#    DATABASE_URL, JWT_SECRET, CORS_ORIGIN, PORT=3000, HOST=0.0.0.0, NODE_ENV=production

# 2. Railway ejecuta automáticamente: npm run build && npm run start
#    O configurar en railway.json: buildCommand, startCommand

# 3. Ejecutar migraciones manualmente (una vez):
npm run migrate:prod --workspace=apps/api

# 4. Verificar health
curl https://your-api.railway.app/health
curl https://your-api.railway.app/health/ready
```

- [ ] `/health` responde 200 con `status: "healthy"`
- [ ] `/health/ready` responde `{ ready: true }`
- [ ] Migraciones ejecutadas (`migrate:prod`)
- [ ] Probar login con usuario QA

## Supabase Storage buckets (configuración manual en dashboard)

| Bucket | Acceso | Escritura |
|---|---|---|
| `driver-photos` | público lectura | autenticado |
| `driver-documents` | privado | owner + admin |
| `user-photos` | público lectura | autenticado |
| `vehicle-photos` | público lectura | rental_operator |

Políticas RLS básicas:
```sql
-- INSERT: solo el propietario
CREATE POLICY "owner insert" ON storage.objects FOR INSERT
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- SELECT privado: owner o admin
CREATE POLICY "owner or admin select" ON storage.objects FOR SELECT
  USING (auth.uid()::text = (storage.foldername(name))[1]);
```

## Deploy mobile

```bash
# Crear .env.production con la URL de la API de producción
cp apps/mobile/.env.production.template apps/mobile/.env.production
# Editar VITE_API_BASE_URL=https://your-api.railway.app/api

# Build de producción
npm run build:prod --workspace=apps/mobile
# Output en apps/mobile/dist/
```

- [ ] `VITE_API_BASE_URL` apunta a API producción
- [ ] Build sin errores
- [ ] Subir `dist/` a hosting (Netlify, Vercel, Railway Static, etc.)
- [ ] Si app nativa: `npx cap sync` y build en Xcode/Android Studio

## Post-deploy

- [ ] Crear usuario admin de producción (registrar con rol admin via DB o script)
- [ ] Configurar tarifas iniciales en `/admin/fare-settings`
- [ ] Activar legal documents en `/admin/legal-documents` (agregar contenido real)
- [ ] Probar flujo completo: registro → solicitar viaje → aceptar → completar → calificar
- [ ] Verificar notificaciones (mensajes de estado en viaje)
- [ ] Monitorear logs Railway por 24h post-deploy

## Crear admin (via SQL directo en DB)

```sql
-- Luego de registrar un usuario, cambiar su rol a admin:
UPDATE users SET role = 'admin' WHERE email = 'admin@rapago.cl';
```

## Rollback

```bash
# Opción 1: revert en Railway (UI → Deployments → Deploy anterior)
# Opción 2: git revert
git revert HEAD
git push origin main

# Si las migraciones son destructivas, restaurar backup de DB antes de revert
```

## Variables de entorno requeridas (resumen)

| Variable | Dónde | Obligatoria |
|---|---|---|
| `DATABASE_URL` | API | Sí |
| `JWT_SECRET` | API | Sí |
| `CORS_ORIGIN` | API | Sí |
| `PORT` | API | No (default 3000) |
| `HOST` | API | No (default 0.0.0.0) |
| `NODE_ENV` | API | Recomendado (`production`) |
| `VITE_API_BASE_URL` | Mobile (build time) | Sí |
