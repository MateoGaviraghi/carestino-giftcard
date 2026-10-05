# MEMORY — carestino-giftcard

Registro durable de decisiones (`D-NNN`), gotchas (`G-NNN`), deuda técnica (`TD-NNN`) y preguntas abiertas (`OQ-NNN`). Solo se agregan entradas. Una decisión que cambia se registra como entrada nueva con "reemplaza D-0NN", sin editar la anterior.

Este archivo arranca el 2026-10-05. Las decisiones anteriores (migración a Neon, health check que no bloquea, `create` en vez de `upsert`, eliminación de `CANCELLED`) solo están en los mensajes de `git log` y en `PROJECT-BRAIN.md` §5 y §7.

---

## Decisiones

### D-001 — Medio de pago por gift card, solo para el admin (2026-10-05)
- **Qué:** cada gift card registra cómo se pagó: Efectivo, Transferencia o Tarjeta. "Tarjeta" no distingue débito de crédito; Mateo pidió literalmente que diga solo "Tarjeta".
- **Modelo:** enum `PaymentMethod { CASH TRANSFER CARD }` y campo `paymentMethod PaymentMethod?` en `GiftCard`. Los valores van en inglés, igual que `GiftCardStatus`; las etiquetas en español viven en `PAYMENT_LABEL` (`src/app/page.tsx`).
- **Opcional en la base, obligatorio en el alta:** la columna admite null porque las gift cards emitidas antes no tienen el dato, y en la tabla muestran "—". Pero el `POST /api/giftcards` exige uno de los tres valores (400 si no) y el formulario lo marca `required`, así que toda emisión nueva lo trae.
- **Nunca en la tarjeta:** no se pasa a `cardData` ni a `GiftCard.tsx`, así que no aparece en la vista previa, el PDF ni el MP4.
- **Idempotencia:** el medio de pago forma parte de `sameCard` en el `POST`. Un reintento con el mismo código y otro medio de pago cuenta como colisión (409), no como el mismo alta.
- **UI:** tres botones separados (`grid-cols-3 gap-2`), con relleno naranja y ✓ en el elegido. **Descartado:** el control segmentado pegado, igual al toggle "Monto en $ / Producto". Mateo lo rechazó porque "no se evidencia cual es cual".
- **Se mostró en:** la tabla del generador (`/`), como columna "Pago" en desktop y al lado de la fecha en mobile. **No** en `/admin` (ver OQ-001).
- **Se reabre si:** se piden más medios (ej. Mercado Pago, débito/crédito por separado) o se quiere el dato en `/admin`.

---

## Gotchas

### G-001 — La CLI de Prisma no ve `.env.local`
- **Síntoma:** `npx prisma db push` → `Error: The datasource.url property is required in your Prisma config file when using prisma db push.`
- **Causa:** `prisma.config.ts` hace `import "dotenv/config"`, que solo carga `.env`. La `DATABASE_URL` del repo vive en `.env.local` (que lee Next, no dotenv), y no hay `.env`.
- **Cómo se corrió:** pasando la variable inline solo para el comando, sin imprimirla:
  `DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')" npx prisma db push`
- **Ojo:** esa URL es la base de **producción** en Neon. Cualquier comando de Prisma corrido así escribe en producción. El comando de `PROJECT-BRAIN.md` §6 (`npx prisma db push` a secas) no anda tal cual por esta causa.

### G-002 — El servidor local usa la base de producción
- `.env.local` apunta a la misma base Neon que producción. Emitir, marcar como usada o borrar una gift card desde `localhost` cambia datos reales. Por eso esta feature se verificó sin emitir nada de prueba.

### G-003 — El puerto 3000 puede estar ocupado por otro proyecto
- `.claude/launch.json` (sin trackear) tiene `"autoPort": true` desde 2026-10-05. Si el 3000 está tomado, el preview levanta en otro puerto (ese día, `49734`). La cookie de sesión es por puerto: hay que loguearse de nuevo en el puerto que se asignó.

---

## Deuda técnica

### TD-001 — Entradas viejas en la cola "sin guardar"
- Las gift cards que quedaron en `localStorage` (`carestino:giftcards-pendientes`) antes de `bec0853` no tienen `paymentMethod`. "Reintentar guardado" las manda al `POST`, que ahora responde 400 `"Medio de pago inválido"`, y quedan en la cola para siempre.
- Se asumió porque la cola normalmente está vacía. **Se paga** si aparece una entrada así: hay que darle un medio de pago a mano o hacer que el reintento lo pida.

### TD-002 — Sin forma de cargar el medio de pago a gift cards existentes
- Las gift cards emitidas antes del 2026-10-05 muestran "—" y no hay UI para completarlo. No se revisó si el `PATCH /api/giftcards/[code]` aceptaría el campo (**sin verificar**). **Se paga** si Mateo quiere completar el histórico (OQ-002).

---

## Preguntas abiertas

### OQ-001 — ¿Columna "Pago" también en `/admin`?
- `src/app/admin/page.tsx` tiene su propia tabla (Código, Destinatario, Monto/Producto, Fecha, Estado, Acciones) y no muestra el medio de pago. Quedó fuera a propósito porque el pedido era "no te entreveres con otras cosas". Decide Mateo.

### OQ-002 — ¿Completar el medio de pago de las gift cards anteriores?
- Ver TD-002. Decide Mateo si hace falta y cómo (a mano en la base o con un selector editable en la tabla).
