# Cierre técnico de los puntos 25 y 26

## Punto 25 — funciones futuras

La build de lanzamiento usa flags cerrados por defecto en frontend y backend:

- turismo/guías: desactivado;
- arriendo/reserva de vehículos: desactivado;
- eventos/entradas: desactivado.

Los botones y tarjetas no se renderizan. Las rutas directas web redirigen a 404 y los módulos API no se registran en producción. Las postulaciones directas de guía u operador de arriendo responden `FEATURE_NOT_AVAILABLE` mientras el módulo esté cerrado.

La pantalla de acceso se sirve en `/`. La ruta histórica `/auth/login` solo redirige a `/`, por lo que no aparece como URL inicial.

## Punto 26 — preparación técnica

Quedan preparados:

- configuración de producción sin sourcemaps;
- flags de lanzamiento cerrados;
- Android con backup y tráfico HTTP claro desactivados;
- versión Android parametrizada;
- firma AAB mediante variables seguras;
- script de verificación de release;
- script para generar AAB y hash SHA-256;
- plantillas de cuentas, notas de revisión, Data Safety y aprobaciones.

## Acciones humanas obligatorias antes de enviar a Google Play

1. Completar cuentas QA reales sin escribir contraseñas en Git.
2. Configurar el keystore en un equipo seguro.
3. Ejecutar `npm run build:android:aab`.
4. Probar el AAB en una pista interna.
5. Completar Data Safety con Jurídica/Privacidad.
6. Adjuntar capturas, icono, ficha y video de ubicación cuando corresponda.
7. Registrar firmas de Desarrollo, Soporte, Jurídica y Gerencia.

La integración y validación iOS permanecen como dependencia externa y no forman parte del trabajo Android de este cierre.
