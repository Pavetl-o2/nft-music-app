# ACE-Step 1.5 — Contrato de API y troubleshooting

Referencia de cómo la app habla con ACE-Step 1.5. Rescatado de la depuración
hecha contra el pod de RunPod (puerto `8001` vía proxy).

Implementación viva: [`lib/acestep.ts`](lib/acestep.ts) y [`lib/fusion.ts`](lib/fusion.ts).

---

## 1. Flujo completo

La generación son **tres llamadas**, no una:

```
POST /release_task      -> task_id
POST /query_result      -> (polling cada 3s) -> path del audio
GET  /v1/audio?path=... -> WAV binario
```

### 1.1 `POST /release_task`

Body = el `FusionPayload` completo. Respuesta:

```json
{ "data": { "task_id": "abc123..." } }
```

El `task_id` se lee de `data.data.task_id`.

### 1.2 `POST /query_result`

**El campo se llama `task_id_list` y es un ARRAY.** No `task_id`.
Confirmado leyendo el código fuente del servidor (`query_result_route.py`):
`body.get("task_id_list", "[]")`.

```json
{ "task_id_list": ["abc123..."] }
```

Respuesta:

```json
{ "data": [ { "status": 1, "result": "<string JSON>" } ] }
```

| `status` | Significado |
|---|---|
| `0` | procesando |
| `1` | terminado con éxito |
| `2` | falló |

**`result` es un string JSON, no un objeto.** Hay que `JSON.parse()` sobre él.
Adentro viene un array; el path del audio está en `[0].file`.

### 1.3 `GET /v1/audio`

Devuelve el WAV binario (48 kHz).

---

## 2. Payload de generación

Construido por `fuseCharacters()` en `lib/fusion.ts` a partir de los
`game_params` de los 3 personajes:

| Campo | Origen |
|---|---|
| `prompt` | fusión de keywords de rhythm + melody + vocals + género |
| `lyrics` | generadas con Gemini 2.5 Flash vía OpenRouter |
| `bpm` | punto medio de `tempo_min`/`tempo_max` del **rhythm** |
| `key_scale` | `key_preference` + `mode` de la **melody** |
| `time_signature` | del **rhythm** |
| `audio_duration` | dinámica según nº de líneas cantadas (ver §3.3) |
| `batch_size` | `1` |
| `inference_steps` | `30` si los 3 comparten género, si no `25` |
| `vocal_language` | de los **vocals** |
| `thinking` | `true` |
| `audio_format` | `"wav"` |

---

## 3. Errores que ya resolvimos

Guardar esto: cada uno costó una sesión de depuración.

### 3.1 `query_result` siempre devolvía `{"data":[]}`

**Causa:** se mandaba `{"task_id": "..."}`.
**Fix:** el campo correcto es `{"task_id_list": ["..."]}` — array, y nombre distinto.

### 3.2 `403 Forbidden` al pedir el audio

**Causa:** el campo `file` que devuelve `query_result` **ya viene** como
`/v1/audio?path=...`. Al concatenarle otra vez `/v1/audio?path=` quedaba
la URL duplicada.

**Fix:** detectar el prefijo antes de construir la URL.

```ts
const audioFetchUrl = audioPath.startsWith('/v1/') || audioPath.startsWith('/api/')
  ? `${BASE_URL}${audioPath}`
  : `${BASE_URL}/v1/audio?path=${audioPath}`
```

### 3.3 `404 Not Found` al pedir el audio

**Causa:** un fallback que asumía que el archivo se llamaba igual que el
`task_id`. **El UUID del archivo de audio NO es el `task_id`** — son valores
distintos. Confirmado en los logs del pod.

**Fix:** se eliminó ese fallback. El path del audio **solo** se obtiene del
campo `file` de `query_result`.

### 3.4 VRAM OOM en RTX 4090

**Causa:** `audio_duration` llegaba a 240s y reventaba la memoria de la GPU.

**Fix:** duración dinámica acotada a **120s máximo**.

```ts
const sungLines = lyrics.split('\n').filter(l => l.trim() && !l.trim().startsWith('[')).length
const audioDuration = Math.min(120, Math.max(60, sungLines * 8 + 20))
```

Las líneas que empiezan con `[` (ej. `[Verse]`, `[Chorus]`) no cuentan:
son marcadores de estructura, no letra cantada.

### 3.5 Timeout en Vercel

La generación tarda ~1–4 min. Requisitos:

- `export const maxDuration = 300` en `app/api/generate/route.ts`
- El polling de `waitForResult()` corta a los **280s** (deja margen antes del límite de Vercel)

### 3.6 Botones no clickeables en el reproductor

No es de ACE-Step, pero se depuró en la misma sesión.
**Causa:** `.card::before` con `position:absolute; inset:0` interceptaba todos
los clicks. **Fix:** `pointer-events: none` en el pseudo-elemento.

---

## 4. La respuesta llega como binario, no como JSON

`app/api/generate/route.ts` devuelve el WAV directo, con metadata en headers:

```ts
new NextResponse(new Uint8Array(audioBuffer), {
  headers: {
    'Content-Type': 'audio/wav',
    'X-Task-Id': taskId,
    'X-Lyrics': encodeURIComponent(lyrics),
  },
})
```

Notas:

- `new Uint8Array(buffer)` — pasar un `Buffer` de Node directo a `NextResponse`
  no compila en TypeScript (no es un `BodyInit` válido).
- Las letras viajan en el header `X-Lyrics` **url-encoded**, porque los headers
  HTTP no admiten saltos de línea ni acentos.
- El cliente hace `URL.createObjectURL(blob)` para reproducir, y revoca las URLs
  en un `useEffect` de limpieza.

### `game_params` se leen en el servidor

Los `game_params` son privados y **nunca** se exponen al frontend. La ruta
`/api/generate` recibe solo los 3 IDs y hace la consulta a Supabase con
`SUPABASE_SERVICE_ROLE_KEY` para traerlos.

Si se intentan leer del payload del cliente, revienta con
`Cannot read properties of undefined (reading 'tempo_min')`.

---

## 5. Variables de entorno

### Pod (configuración actual)

```env
ACESTEP_BASE_URL=https://<pod-id>-8001.proxy.runpod.net
```

### Serverless (migración en curso)

RunPod Serverless usa una API **distinta** — el contrato de arriba se envuelve
dentro de un handler:

```
POST https://api.runpod.ai/v2/<endpoint_id>/run     -> { "id": "..." }
GET  https://api.runpod.ai/v2/<endpoint_id>/status/<id>
```

Diferencias frente al pod:

- Autenticación con `Authorization: Bearer <RUNPOD_API_KEY>` (el pod no la tenía)
- El payload se envuelve: `{ "input": { ...FusionPayload } }`
- El audio se devuelve en base64 dentro del JSON de respuesta, no como stream binario
- Hay **cold start**: la primera petición tras un rato de inactividad tarda más
- Los pesos del modelo se guardan en un network volume para no re-descargarlos

Variables nuevas:

```env
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT_ID=...
```
