# Lunas Confort - Cotizador App

Clon 1:1 del cotizador de Google Apps Script construido en Next.js 15.

## Requisitos Previos
- Node.js 18.17 o superior.
- Git.

## Desarrollo Local
1. `npm install`
2. Configurar `.env.local`:
   ```env
   VENDOR_PASSWORD=123456
   ADMIN_PASSWORD=123456789
   JWT_SECRET=super_secret_jwt_key_for_lunas_confort_99
   SOURCE_FILE_TYPE=pdf
   CACHE_TTL_SECONDS=600
   NEXT_PUBLIC_APP_NAME="Lunas Confort"
   ```
3. Ejecutar servidor de desarrollo `npm run dev`.
4. Ir a `http://localhost:3000`.

Roles:
- **Vendedor:** ir a `/` e ingresar con la password `123456`.
- **Administrador:** ir a `/config` e ingresar con la password `123456789`.

## Pruebas
- **Unit Tests:** `npx vitest` (Comprueba cálculos de cuota, normalización de precios).
- **Playwright E2E:** `npx playwright test` (Verifica flujo de login y renderizado de módulos).

---

## 🚀 Despliegue en Vercel (Paso a Paso)
Dado que la App Router no usa Base de Datos, se basa en caché en runtime.

1. Sube el código a un repositorio Git (GitHub/GitLab).
2. Entra en Vercel y haz clic en **"Add New Project"**.
3. Selecciona el repositorio de **Lunas Confort**.
4. En la sección **Environment Variables**, define:
   - `VENDOR_PASSWORD=...`
   - `ADMIN_PASSWORD=...`
   - `JWT_SECRET=...`
   - `SOURCE_FILE_TYPE=pdf` o `excel`
   - *(Opcional)* `SOURCE_FILE_URL` si tienes el PDF alojado en la nube de forma pública. En su defecto, se podrá subir desde el panel Admin pero **ojo**, la subida local de un panel Vercel va a `/tmp` temporal, si el servidor Serverless entra en cold-start se perderá el archivo subido de manera que para Vercel es altamente recomendado un URL público o dejar un PDF estático en la raíz del repo (como el provisto).
5. Haz clic en **Deploy**.

---

## ✅ Checklist de Paridad “Original vs Nueva App”
El flujo es estrictamente el solicitado:
- [x] Login vendedor (/)
- [x] Cotizador principal (/cotizador)
- [x] Selector de lista (ej. local, valles) - configurable en Admin
- [x] Carga de productos por lista y normalización
- [x] Búsqueda y selección rápida
- [x] Columna: Simple (1 producto + qty/anticipo)
- [x] Columna: Carrito (múltiples productos + check combo)
- [x] Columna: Manual (producto libre)
- [x] Ficha/Nota de pedido modal completo
- [x] Botón COPIAR y ENVIAR POR WHATSAPP
- [x] Botón SALIR (Cerrar sesión vendedor)

## ⚠️ Lista de Riesgos Abiertos y Mitigación
1. **Riesgo:** Persistencia de archivos en Serverless (Vercel). Vercel es "stateless" (sin estado). Si el archivo se sube desde el panel, irá a la carpeta temporal y estará disponible, pero tras un reinicio del servidor (cold starts), el archivo se perderá si no está commiteado en GitHub.
   - *Mitigación:* Se implementó `SOURCE_FILE_URL` como variable de entorno. La recomendación oficial es subir el Excel/PDF a un s3 o URL estática accesible publicamente, o actualizar el repositorio vía Git con el archivo `LISTA_DE_PRECIOS.pdf` commiteado directamente (en lugar de usar UI de "upload").
2. **Riesgo:** Caché en Memoria (`global.catalogCache`). Al igual que los archivos, las variables locales en Node.js pueden perderse si Vercel levanta otra réplica o hace cold start.
   - *Mitigación:* Se diseñó de manera que si la memoria se pierde, y un usuario accede al catálogo, el backend vuelve a descargar de `SOURCE_FILE_URL` o disco automáticamente, reconstituyendo su memoria, logrando la máxima transparencia para el usuario.
# superlunas
