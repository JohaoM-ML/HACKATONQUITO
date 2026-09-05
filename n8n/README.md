# WhatsApp vecinos — VENTANA SECA (Twilio + n8n)

Hay **dos caminos**. El nuevo es el agente de seguimiento de criaderos. El viejo solo responde cortes + tip de tanques.

## Camino A — agente de seguimiento (recomendado)

```
Vecino → Twilio Try out WhatsApp (Inbound + Custom webhook)
       → n8n ACK vacío al instante (sin TwiML ni texto)
       → Agent n8n (guarda reporte / zona A-B)
       → Messages API: To + From + ContentSid
```

En la consola **nueva** el trial no acepta TwiML ni `Body` libre. Solo plantillas Twilio (`ContentSid`).

Recordatorios (otro workflow, 09:00):

```
Schedule → tabla seguimiento_criaderos → filtro consentimiento + ventana 24h → Twilio WhatsApp
```

| Pieza | Dónde |
|-------|--------|
| Agent (**publicado**) | https://joystick1416.app.n8n.cloud/projects/2DBtXqAU4x06P2oV/agents/uG4Q32vXBgO7Mb1X |
| Webhook WhatsApp | https://joystick1416.app.n8n.cloud/workflow/s9s98kEH11P7m8It |
| Recordatorios | https://joystick1416.app.n8n.cloud/workflow/b9ofuCYb2M3wo7ee |
| Tabla | `seguimiento_criaderos` (mismo proyecto n8n) |

Qué hace el vecino: `reportar` (balde, llanta, tanque, florero, larvas) → acciones concretas → si dice **SÍ**, recordatorio a 3 días (máx. 3). `LISTO` cierra. `PARAR` / `alto` / `baja` = opt-out. También `cortes` / `zona` / `consejo`.

Avisos de zona (cola operativa, no predicción de dengue):

- **Zona A** (corte/cola de esta semana): tapa tanques; pueden pasar brigadistas a **revisar recipientes**. No se confirma fumigación.
- **Zona B** (7–14 días post-corte, hipótesis): cuidado en casa. B **no** agenda sola la ruta ni confirma fumigación.

Los textos **no** prometen menos dengue ni que se evita la enfermedad.

### Para que funcione

n8n no deja crear credenciales por MCP: hay que pegarlas en la UI (no las subas al repo).

1. **OpenAI en el Agent**  
   Abre el Agent → en el modelo (GPT-4.1 mini) → Create credential → pega la API key `sk-proj-…` → Save.  
   Sin esto el Agent no corre.

2. **Twilio Basic Auth en el webhook (obligatorio)**  
   Workflow *WhatsApp seguimiento criaderos* → nodo **Enviar WhatsApp API**:  
   Authentication = Generic → **Basic Auth** (no uses la de OpenAI).  
   User = Account SID. Password = Auth Token.  
   El nodo solo manda `To`, `From` y `ContentSid` (regla del trial 2026).

3. Activa / publica ambos workflows.
4. En la consola **nueva**: Messaging → WhatsApp → **Try out WhatsApp** → **Inbound** → Auto-Reply **Custom**.  
   URL completa (no recortes):  
   `https://joystick1416.app.n8n.cloud/webhook/whatsapp-seguimiento-criaderos`  
   Request method: **HTTP POST**.  
   El trial nuevo ignora `text/plain`. n8n responde TwiML XML y reenvía el texto por la Messages API.  
   En el nodo **Enviar WhatsApp API** pega Basic Auth (User = Account SID, Password = Auth Token).
5. El número de prueba debe tener `join <código>` vigente (caduca cada 3 días).
6. La plantilla sandbox (p. ej. Appointment Reminders) **no es un texto de dengue**. Sirve para probar el tubo. Para el pitch, crea una plantilla propia en Content Template Builder.
7. Trial: ~50 msgs/día. Si pegaste SID/token/key en un chat, rótalos después del demo.

Tras cambiar avisos A/B, hay que **republicar** el Agent para que WhatsApp use el draft.

## Camino B — solo cortes (legacy)

```
Vecino → Twilio WhatsApp → n8n webhook → GET /api/public/cortes → TwiML reply
```

Fallback (si n8n cae): apunta Twilio a `POST /api/public/whatsapp` en la app Next.js.

## Endpoints de la app

| Método | Ruta | Auth | Uso |
|--------|------|------|-----|
| `GET` | `/api/public/cortes` | No | JSON: cortes + colas A/B; `?sector=` arma `mi_zona` (CORS `*`) |
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
