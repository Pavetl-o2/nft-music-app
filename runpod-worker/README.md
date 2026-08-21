# ACE-Step 1.5 — worker de RunPod Serverless

Empaqueta ACE-Step 1.5 como endpoint serverless. Reemplaza el pod que había
que pausar a mano para no quemar créditos.

## Cómo funciona

El servidor de ACE-Step es HTTP normal, así que el worker **no reimplementa la
inferencia**: levanta `acestep-api` en `localhost:8001` dentro del contenedor y
le reenvía cada job. Reusa el mismo flujo de 3 llamadas que ya está depurado
en [`ACESTEP.md`](../ACESTEP.md).

```
RunPod  ->  handler.py  ->  localhost:8001  ->  audio en base64
```

## Archivos

| Archivo | Qué hace |
|---|---|
| `handler.py` | El worker. Arranca el servidor, encola el job, hace polling, devuelve el audio |
| `Dockerfile` | Imagen CUDA 12.4 + Python 3.11 + ACE-Step 1.5 |
| `../.github/workflows/build-worker.yml` | Construye y publica la imagen en `ghcr.io` |

## Los pesos NO están en la imagen

Los modelos pesan ~15 GB. En vez de meterlos en la imagen, se descargan **una
sola vez** en el volumen de red montado en `/runpod-volume`, y de ahí en
adelante quedan cacheados.

Ventajas: la imagen es chica y se construye gratis en GitHub Actions, y
actualizar modelos no obliga a reconstruir nada.

Costo: **la primerísima petición tarda bastante** (descarga los 15 GB). Las
siguientes ya no.

## Formato de entrada y salida

El campo `input` es el payload de ACE-Step tal cual, sin envolver:

```json
{
  "input": {
    "prompt": "punk rock, distorted guitars, female vocals",
    "lyrics": "[Verse]\n...",
    "bpm": 128,
    "audio_duration": 90,
    "inference_steps": 8,
    "audio_format": "mp3",
    "thinking": true
  }
}
```

Respuesta:

```json
{
  "task_id": "...",
  "audio_base64": "...",
  "audio_format": "mp3",
  "size_bytes": 2874112,
  "seconds": 42.3,
  "metas": { "bpm": 128, "duration": 90 }
}
```

### Usa `mp3`, no `wav`

RunPod devuelve el resultado como JSON, y el audio va en base64 dentro de ese
JSON. Un WAV de 120 s pesa ~23 MB, que en base64 son ~31 MB — se pasa de los
límites de payload de RunPod.

En MP3 el mismo audio son ~3 MB. El worker no fuerza el formato: se decide en
`audio_format` desde la app.

## Variables de entorno

Se configuran en el endpoint de RunPod. Todas tienen default en el Dockerfile.

| Variable | Default | Para qué |
|---|---|---|
| `ACESTEP_CONFIG_PATH` | `acestep-v15-turbo` | Modelo DiT. Turbo = 8 pasos |
| `ACESTEP_LM_MODEL_PATH` | `acestep-5Hz-lm-0.6B` | LM que usa `thinking: true` |
| `ACESTEP_LM_BACKEND` | `pt` | `vllm` es más rápido pero arranca mucho más lento |
| `ACESTEP_OFFLOAD_TO_CPU` | — | Ponlo en `true` si te topas con OOM de VRAM |
| `HF_HOME` | `/runpod-volume/huggingface` | Dónde se cachean los pesos |
| `WORKER_BOOT_TIMEOUT` | `1800` | Margen para la descarga inicial |
| `WORKER_JOB_TIMEOUT` | `900` | Corte por job |

## GPU recomendada

Con turbo 2B + LM 0.6B bastan **6–8 GB** de VRAM. Aun así conviene **24 GB**:
audios de hasta 120 s consumen bastante más, y con menos margen ya hubo un OOM
antes (ver `ACESTEP.md` §3.4).

## `inference_steps`

El modelo turbo está destilado para **8 pasos**. Mandarle 25–30 no mejora nada
y triplica el tiempo de GPU — que en serverless se paga por segundo.
