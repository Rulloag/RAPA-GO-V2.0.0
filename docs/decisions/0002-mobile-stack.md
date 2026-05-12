# ADR-0002: Stack Mobile — Ionic React + Capacitor + TypeScript

**Estado**: Aprobado
**Fecha**: 2026-05-11
**Autor**: Rodrigo Alexander Ulloa González

## Contexto

Se necesita una app mobile que funcione en Android e iOS con acceso a APIs nativas (GPS, push notifications, cámara) y que comparta el mayor código posible entre plataformas.

## Decisión

**Ionic React** como framework de componentes UI mobile, **Capacitor** como bridge nativo, **TypeScript** como lenguaje.

## Motivo

- **Un solo codebase para Android e iOS**: Ionic + Capacitor genera apps nativas reales para ambas plataformas desde una base TypeScript/React.
- **TypeScript compartido con backend**: El mismo lenguaje en mobile y backend facilita compartir tipos y esquemas.
- **Capacitor vs Cordova**: Capacitor es la alternativa moderna recomendada por el equipo de Ionic, con mejor soporte para APIs nativas recientes.
- **React**: Familiaridad del equipo, ecosistema maduro, compatibilidad con Ionic components.
- **Componentes Ionic**: Biblioteca de componentes UI con estilo nativo (iOS/Android) sin trabajo de diseño desde cero.

## Consecuencias

- Rendimiento ligeramente inferior a apps 100% nativas (React Native, Swift, Kotlin). Aceptable para este tipo de aplicación.
- El equipo debe conocer React y TypeScript. No requiere conocimiento de Kotlin/Swift.
- Las APIs nativas (GPS, push, cámara) se acceden via plugins de Capacitor. Si un plugin no existe, se puede escribir nativo.

## Alternativas descartadas

- **React Native**: Mayor rendimiento nativo pero requiere conocer el ecosistema RN (Metro bundler, bridging). La curva de aprendizaje no justifica el beneficio para este proyecto.
- **Flutter**: Diferente lenguaje (Dart), no comparte código con el backend TypeScript.
- **App nativa separada**: Doblar el esfuerzo de desarrollo para iOS y Android. No viable con el equipo actual.
