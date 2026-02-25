# Arquitectura Detallada: Lunas Confort Cotizador

## 1. Patrones y Estructura Next.js 15
El proyecto se basa en la convención `app` de Next.js:
- `app/(auth)/page.tsx`: Pantalla de Login (Vendedor).
- `app/cotizador/page.tsx`: Panel principal del vendedor, protegido por middleware.
- `app/config/page.tsx` y `app/config/panel/page.tsx`: Rutas de administrador.
- `app/api/...`: Rutas de Edge/Node.js para autenticación, acceso a productos y source loader.
- `components/`: Componentes modulares, divididos por ui/ (genéricos) y modulos/ (específicos del cotizador).
- `lib/`: Lógica de negocio core (sourceLoader, product-parser, calculator, auth-utils).

## 2. In-Memory Data Layer (Sin BD)
Debido a la restricción arquitectónica clave "No usar base de datos" y "No depender del file system de Vercel como BD persistente":
1. **Parser & Loader**: `lib/sourceLoader.ts` descarga o lee el archivo fuente local `LISTA DE PRECIO LOCAL TACO RALO CATAMARCA.pdf`.
2. **Parsing**: Para PDF usa expresiones regulares sobre `pdf-parse` (extrae código, nombre, precio, stock).
3. **Cache Global**: El resultado del parsing se almacena en una variable global (`global.productCatalogCache`) dentro del entorno Node. Este caché es validado mediante un TTL (Time To Live).
4. **Fallback**: Si falla la actualización del origen, se mantiene sirviendo el último caché válido.

## 3. Seguridad
- Autenticación manejada mediante `jose` para la firma de JSON Web Tokens.
- Se emiten cookies `httpOnly`, `secure`, `sameSite=lax` para el rol vendor o admin.
- Contraseñas estáticas verificadas contra `.env.local` (`VENDOR_PASSWORD`, `ADMIN_PASSWORD`).
- `middleware.ts` intercepta llamadas a rutas protegidas (`/cotizador`, `/config/panel`).

## 4. Estado de la Aplicación en el Cliente
Dada la paridad 1:1, la pantalla del cotizador (carrito, modo simple y modo manual) es muy interactiva:
- Se implementará el estado con React Hook o React Context, aislando la lógica en `hooks/useCotizador.ts`.

## 5. Reglas de Negocio en Configuración
- El panel de Admin permite subir un nuevo archivo PDF. Esta subida reemplaza un archivo persistido estáticamente (en entorno local) o provee los datos directamente a la caché. Se debe tener en cuenta la limitación de Vercel sobre FS. En despliegues la función de "subir" guardaría en memoria (o en una variable temporal) y sobreescribiría la caché.
- Modificación de cálculos (fórmula base: `total = base * (1 + interes/100)`, `cuota = (total - anticipo) / semanas`).
