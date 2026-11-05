# 0002. React + Vite en lugar de Next.js

- **Estado:** Aceptado
- **Fecha:** 2026-10-31

## Contexto
El desarrollador está aprendiendo React "puro" en un curso. El sistema es un panel interno con login: no necesita SEO ni páginas públicas.

## Decisión
Una SPA (Single Page Application) con **React + Vite + TypeScript** en `web/`. Las peticiones van a la API de `api/`.

## Alternativas consideradas
- **Next.js:** es un framework sobre React que agrega rutas por archivos, renderizado en el servidor (SSR) y rutas de API. Sus ventajas principales (SEO, primera carga más rápida) no aplican a un panel con login. Además mezcla código de cliente y de servidor en el mismo proyecto, lo cual confunde mientras se aprenden los fundamentos.
- **Create React App:** está deprecado y es lento. Vite es el estándar actual.

## Consecuencias
- ✅ Lo que se aprende en el curso se aplica directo.
- ✅ Vite arranca en milisegundos y recarga al instante (HMR).
- ✅ Los componentes son React estándar: migrar a Next más adelante es mover archivos, no reescribir.
- ⚠️ El enrutado (React Router) y el manejo de datos del servidor (TanStack Query) hay que elegirlos e instalarlos uno mismo.

## En una entrevista
"Elegí una SPA con Vite porque es una herramienta interna detrás de un login: el SSR y el SEO de Next no aportaban valor y sí complejidad. Mantuve los componentes desacoplados para poder migrar si algún día hay páginas públicas."

> **Comparación con LitElement:** una SPA con Vite es como una app de Web Components que se sirve como archivos estáticos y consume una API. Next sería como agregarle un servidor que pre-renderiza esos componentes.
