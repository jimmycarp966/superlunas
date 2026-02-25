# Architecture Summary: Lunas Confort Cotizador

## Proyecto
- **Nombre:** Lunas Confort - Cotizador
- **Objetivo:** Clon 1:1 del cotizador original (basado en Google Apps Script), construido para Next.js 15, Vercel-ready, sin base de datos tradicional.
- **Fuente de verdad:** Archivo externo o subido (PDF/Excel) desde donde se leen los productos.

## Tech Stack
- Frontend y Backend: **Next.js 15 (App Router)**
- UI: **React, Tailwind CSS, Lucide Icons**
- Parsing de Capa de Datos: **xlsx** (para Excel), **pdf-parse** (para PDF)
- Autenticación: **jose** (JWT sobre cookies HTTPOnly)
- Tests: **Jest** (Unit), **Playwright** (E2E)

## Arquitectura sin Base de Datos
- No se utilizan RDBMS (como Postgres) ni NoSQL permanentes.
- Se implementa un **Source Loader** que lee la fuente configurada (o el archivo subido al panel Admin).
- Se mantiene una **Caché en Memoria** en el runtime de Node.js (con un TTL) para servir a `/api/products` sin re-parsear constantemente el PDF o Excel.
- Las configuraciones (Planes, Redondeo, Intereses) se manejan en memoria temporalmente o con fallback a defaults estáticos, asumiendo su administración temporal.

## Módulos Principales
1. **Login (`/`)**: Entrada global (Vendedor / Admin).
2. **Cotizador (`/cotizador`)**: Selecciona listas, busca productos, vista de tres columnas (Simple, Carrito, Manual). Generación de Ficha/Nota de WhatsApp.
3. **Admin Panel (`/config`)**: Configuración global de la app, subir nueva lista, ajustar variables y planes de pago.
