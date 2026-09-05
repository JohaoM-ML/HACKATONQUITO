# WhatsApp vecinos — VENTANA SECA (Twilio + n8n)

Chatbot por **WhatsApp** (no widget web). Flujo preferido:

```
Vecino → Twilio WhatsApp → n8n webhook → GET /api/public/cortes → TwiML reply
```

Fallback (si n8n cae): apunta Twilio a `POST /api/public/whatsapp` en la app Next.js.

## Endpoints de la app

| Método | Ruta | Auth | Uso |
|--------|------|------|-----|
| `GET` | `/api/public/cortes` | No | JSON: cortes recientes + cola Regla A (CORS `*`) |
| `POST` | `/api/public/whatsapp` | No | Fallback Twilio → TwiML |
| `GET` | `/api/public/whatsapp` | No | Info del fallback |

Requiere `SUPABASE_SERVICE_ROLE_KEY` en el server (RLS de `cortes` / `cola_items` solo permite `authenticated`).

Los textos **no** afirman reducción de dengue: son anuncios Interagua + cola operativa + tip de tapar tanques.

## 1. Twilio sandbox

1. Cuenta en [Twilio](https://www.twilio.com/) → Messaging → Try WhatsApp.
2. Une tu número al sandbox (`join <código>`).
3. En **Sandbox settings**, deja el webhook vacío hasta tener la URL de n8n (paso 3).

## 2. Variables de entorno

### App (`web/.env.local` / Vercel)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # necesario para el endpoint público
NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app
```

### n8n

| Variable | Ejemplo |
|----------|---------|
| `VENTANA_API_URL` | `https://tu-app.vercel.app` (sin slash final) |

En n8n Cloud / self-hosted: Settings → Variables, o env del proceso.

## 3. Importar workflow

1. Abre n8n → **Workflows** → **Import from File**.
2. Elige `n8n/whatsapp-vecinos.json`.
3. Activa el workflow.
4. Abre el nodo **Twilio Webhook** → copia la **Production URL**  
   (algo como `https://TU-N8N/webhook/whatsapp-vecinos`).
5. En Twilio Sandbox → When a message comes in → pega esa URL → método **HTTP POST**.
6. Guarda.

Nodos del flujo:

1. **Twilio Webhook** — recibe `Body` de Twilio  
2. **GET cortes públicos** — `{{$env.VENTANA_API_URL}}/api/public/cortes`  
3. **Armar respuesta ES** — Code node (español, tip tanques, sin promesa de casos)  
4. **Reply TwiML** — responde XML a Twilio  

## 4. Probar

1. Despliega la app y verifica:
   ```bash
   curl -s "$VENTANA_API_URL/api/public/cortes" | head
   ```
2. Envía por WhatsApp al sandbox: `cortes` o `info`.
3. Deberías recibir cortes recientes + tip de tapar tanques.

## Fallback sin n8n

En Twilio Sandbox, apunta el webhook a:

```text
https://tu-app.vercel.app/api/public/whatsapp
```

Misma semántica TwiML; preferí n8n para editar el prompt sin redeploy.

## No hacer

- No pegues Account SID / Auth Token / service role en el JSON del workflow.
- No añadas chat UI al panel ni a la ruta de brigadistas.
