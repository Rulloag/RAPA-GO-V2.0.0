# Sign in with Apple — revocación durante eliminación de cuenta

## Flujo implementado

1. Buscar identidades Apple del usuario.
2. Recuperar el refresh token cifrado.
3. Resolver el `client_id` original guardado en `provider_client_id`.
4. Generar un `client_secret` ES256 de corta duración.
5. Enviar el refresh token al endpoint oficial `/auth/revoke`.
6. Guardar únicamente estado, fecha y error saneado; nunca el token.
7. Anonimizar la cuenta y eliminar identidades solo después de la revocación.

## Variables

- `APPLE_ALLOWED_CLIENT_IDS`
- `APPLE_REVOCATION_DEFAULT_CLIENT_ID`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `OAUTH_TOKEN_ENCRYPTION_KEY`

## Cuentas antiguas

Una identidad Apple antigua puede no tener `provider_client_id` o refresh token. La eliminación no debe fingir éxito:

- Si falta `provider_client_id`, usar el fallback solo cuando sea inequívoco.
- Si falta refresh token, solicitar una nueva autenticación Apple y reintentar.
- La solicitud queda `failed`, visible y reintentable por Administración.

## Prueba QA

- [ ] Login Apple inicial entrega y almacena refresh token cifrado.
- [ ] `provider_client_id` coincide con el audience del identity token.
- [ ] Eliminación registra `apple_revocation_status`.
- [ ] No aparece el token en logs.
- [ ] La cuenta queda sin sesión y sin identidad.
- [ ] La misma cuenta Apple puede registrarse nuevamente.

## Errores esperables

- `AUTH_APPLE_REFRESH_TOKEN_MISSING`: requiere volver a autenticar.
- `AUTH_APPLE_REVOCATION_CLIENT_ID_MISSING`: configurar fallback correcto para identidad antigua.
- `AUTH_APPLE_TOKEN_REVOCATION_UNAVAILABLE`: indisponibilidad temporal; reintentar.
- `AUTH_APPLE_TOKEN_REVOCATION_FAILED`: revisar credenciales, client ID y estado del token.
