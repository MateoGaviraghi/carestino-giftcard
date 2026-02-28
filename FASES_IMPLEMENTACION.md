# Carestino Gift Card — Fases de Implementación

---

## Resumen del Proyecto

Landing page para generación de Gift Cards de **Carestino Bebés Felices** (Santa Fe).  
Stack: **Next.js 14 · React · TypeScript · Tailwind CSS · App Router**

---

## Fase 1 — Estructura Base y Diseño del Gift Card ✅ (Proyecto creado)

**Objetivo:** Levantar el proyecto y construir el componente visual del gift card idéntico al diseño de referencia.

### Tareas

- [x] Inicializar proyecto Next.js 14 con TypeScript + Tailwind
- [ ] Configurar fuentes (tipografía similar al diseño: sans-serif bold/semibold)
- [ ] Crear componente `GiftCard` — replica exacta del diseño:
  - Fondo crema / offwhite
  - Texto naranja (`#C96A1F` aprox.)
  - Campos: NOMBRE, $ monto, Fecha
  - Datos fijos: teléfono, dirección, términos y condiciones
- [ ] Crear página principal `/` con formulario + vista previa lateral en tiempo real
- [ ] Campos del formulario:
  - Nombre del destinatario
  - Monto (`$`) o descripción de producto
  - Fecha
- [ ] Validación básica de formulario

---

## Fase 2 — Vista Previa y Generación de PDF

**Objetivo:** El usuario ve el gift card generado antes de descargar y puede descargarlo como PDF listo para imprimir.

### Tareas

- [ ] Integrar `react-to-print` o `html2canvas` + `jsPDF` para exportar el componente `GiftCard` a PDF
- [ ] Botón **"Descargar PDF"** que genera el PDF con las dimensiones correctas (tarjeta tipo A6 o carta)
- [ ] El PDF debe incluir el código QR / código de seguridad (ver Fase 4)
- [ ] Vista previa modal antes de confirmar la descarga

**Librería recomendada:** `jspdf` + `html2canvas`

```bash
npm install jspdf html2canvas
```

---

## Fase 3 — Código de Seguridad y Base de Datos

**Objetivo:** Cada gift card generada tiene un código único e irrepetible. Se registra en base de datos con estado `USED / ACTIVE`.

### Tareas

- [ ] Elegir base de datos:
  - **Recomendado:** Supabase (PostgreSQL gestionado, gratis, tiene dashboard propio)
  - Alternativa: PlanetScale (MySQL) o SQLite local con Prisma
- [ ] Instalar y configurar **Prisma ORM**
- [ ] Esquema de base de datos:

```prisma
model GiftCard {
  id          String   @id @default(cuid())
  code        String   @unique   // Código de seguridad (ej: CARE-XXXX-XXXX)
  recipientName String
  amount      String
  date        String
  status      GiftCardStatus @default(ACTIVE)
  createdAt   DateTime @default(now())
  usedAt      DateTime?
  notes       String?
}

enum GiftCardStatus {
  ACTIVE
  USED
  CANCELLED
}
```

- [ ] API Route `POST /api/giftcards` — crea el registro y devuelve el código
- [ ] API Route `GET /api/giftcards/[code]` — consulta estado de un código
- [ ] Generar código legible y único. Ejemplo: `CARE-A3F9-XK21`
- [ ] Incluir **código QR** en el gift card que apunta a la URL de verificación

**Librerías:**

```bash
npm install prisma @prisma/client
npm install qrcode react-qr-code
npm install nanoid
```

---

## Fase 4 — Animación (Video MP4 para WhatsApp)

**Objetivo:** Generar un video MP4 de la gift card saliendo de un sobre naranja, que el cliente pueda enviar por WhatsApp como video normal.

### Opciones Evaluadas

#### ✅ OPCIÓN A — Remotion (RECOMENDADA)

- Librería React para crear videos con componentes React
- Se integra perfectamente con Next.js
- La animación se define en React/JSX puro
- Exporta MP4 directamente desde el navegador o servidor
- **Pros:** Control total, mismo diseño del gift card, calidad profesional, fácil de mantener
- **Contras:** Requiere Node.js en servidor para renderizar (no puramente client-side)

```bash
npm install @remotion/player @remotion/renderer remotion
```

#### OPCIÓN B — Lottie + ffmpeg.js (client-side)

- Diseñar la animación del sobre en Adobe After Effects → exportar como Lottie JSON
- Renderizar frames en canvas con `lottie-web`
- Encodear a MP4 con `@ffmpeg/ffmpeg` (WebAssembly, corre en el navegador)
- **Pros:** Todo en el cliente, sin servidor
- **Contras:** Archivos pesados (ffmpeg.wasm ~30MB), lento en dispositivos lentos, animación requiere diseñador

#### OPCIÓN C — Canvas API + ffmpeg.js (client-side, sin dependencias de diseño)

- Animar el gift card con Canvas API y requestAnimationFrame
- Capturar frames con `MediaRecorder` API (nativo del navegador)
- Exportar como WebM → convertir a MP4 con ffmpeg.wasm
- **Pros:** Sin librerías de animación externas, liviano
- **Contras:** Animación más básica, menos fluida

#### OPCIÓN D — Pre-render en servidor con Puppeteer + ffmpeg

- Usar Puppeteer para capturar la animación CSS/JS frame a frame
- Encodear con ffmpeg en el servidor
- **Pros:** Máxima calidad, sin limitaciones del browser
- **Contras:** Requiere servidor, más infraestructura

### Recomendación Final

> **Remotion (Opción A)** para el video generado en servidor al momento de crear la gift card.  
> La animación: el gift card aparece saliendo de un sobre naranja con el logo de Carestino, revelándose con los datos del destinatario.  
> Duración sugerida: 5-8 segundos, formato 9:16 (vertical, ideal para WhatsApp).

### Tareas Fase 4

- [ ] Definir dimensiones y duración del video (recomendado: 1080x1920, 30fps, 6 segundos)
- [ ] Crear composición Remotion con:
  - Escena 1 (0-2s): sobre naranja centrado, cerrado
  - Escena 2 (2-4s): sobre se abre, asoma el gift card
  - Escena 3 (4-6s): gift card sale completamente, se muestra con todos los datos
- [ ] API Route `POST /api/render-video` que recibe los datos y devuelve el MP4
- [ ] Botón **"Descargar Video (WhatsApp)"**

---

## Fase 5 — Panel Administrativo

**Objetivo:** Carestino puede ver todas las gift cards generadas, filtrarlas y marcar como utilizadas.

### Tareas

- [ ] Ruta protegida `/admin` con autenticación básica
- [ ] Configurar **NextAuth.js** con usuario/contraseña (sin registro público)
- [ ] Tabla de gift cards con columnas:
  - Código de seguridad
  - Nombre destinatario
  - Monto / Producto
  - Fecha de creación
  - Fecha de uso
  - Estado (ACTIVE / USED / CANCELLED)
- [ ] Filtros:
  - Por estado
  - Por fecha
  - Búsqueda por nombre o código
- [ ] Acción: Marcar gift card como **"Utilizada"** (con confirmación)
- [ ] Acción: Cancelar gift card
- [ ] Vista de detalle de una gift card
- [ ] Dashboard con estadísticas básicas: total emitidas, utilizadas, pendientes

**Librerías:**

```bash
npm install next-auth
npm install @tanstack/react-table  # tabla con filtros
```

---

## Fase 6 — Verificación Pública del Código

**Objetivo:** La tienda puede escanear el QR y verificar instantáneamente si la gift card es válida.

### Tareas

- [ ] Página pública `/verify/[code]` que muestra:
  - ✅ VÁLIDA — Nombre, monto, fecha de emisión
  - ❌ UTILIZADA — Fecha en que fue usada
  - ⛔ CANCELADA
- [ ] Solo desde el panel admin se puede marcar como usada (no público)
- [ ] Diseño de la página de verificación acorde a la marca Carestino

---

## Fase 7 — Deploy y Producción

### Tareas

- [ ] Variables de entorno (`.env.local`):
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
- [ ] Deploy en **Vercel** (recomendado, nativo para Next.js)
- [ ] Base de datos en **Supabase** (tier gratuito disponible)
- [ ] Dominio personalizado (opcional)
- [ ] Configurar carpeta de storage para videos generados (Supabase Storage o Vercel Blob)

---

## Orden de Implementación Sugerido

```
Fase 1 → Fase 2 → Fase 3 → Fase 5 → Fase 6 → Fase 4 → Fase 7
```

> Se deja Fase 4 (video) para el final porque es la más compleja y necesita confirmación de la opción de animación.

---

## Decisiones Pendientes de Confirmar

1. **Animación (Fase 4):** ¿Preferís Remotion (requiere servidor para renderizar) o ffmpeg.js (todo en el cliente, más lento)?
2. **Base de datos:** ¿Supabase (cloud, fácil) o SQLite local con Prisma (sin cloud)?
3. **Admin auth:** ¿Un solo usuario admin con contraseña fija, o múltiples usuarios?
4. **Formato del video:** ¿9:16 vertical (WhatsApp status/story) o 1:1 cuadrado?
