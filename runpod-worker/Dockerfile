# ACE-Step 1.5 as a RunPod Serverless worker.
#
# Mirrors the official Dockerfile from the ACE-Step-1.5 repo (CUDA runtime
# base, Python 3.11, `uv sync --frozen`) and adds the RunPod handler on top.
#
# Model weights are NOT baked in. They download once into the mounted network
# volume via ACESTEP_CHECKPOINTS_DIR, so the image stays small enough to build
# on the free GitHub Actions runners.

ARG CUDA_VERSION=12.8.1
FROM nvidia/cuda:${CUDA_VERSION}-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    TOKENIZERS_PARALLELISM=false

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        wget \
        ca-certificates \
        ffmpeg \
        libsndfile1 \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# uv provides both the Python runtime and the dependency resolution.
# ACE-Step 1.5 needs Python 3.11-3.12; Ubuntu 22.04 ships 3.10.
ENV UV_VERSION=0.7.13
RUN curl -LsSf https://astral.sh/uv/${UV_VERSION}/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /opt
RUN git clone --depth 1 https://github.com/ace-step/ACE-Step-1.5.git acestep

WORKDIR /opt/acestep
# --frozen installs exactly what uv.lock pins, so the image is reproducible.
RUN uv python install 3.11 \
    && uv sync --frozen --no-dev

# RunPod SDK + requests go into the same venv so `uv run` resolves them.
RUN uv pip install runpod requests

# Falla el build si el venv no quedó donde el CMD lo va a buscar, o si le falta
# algo. Descubrir esto en runtime cuesta un worker muerto y una cola atascada.
RUN /opt/acestep/.venv/bin/python -c \
      "import runpod, requests, acestep; print('venv OK')"

COPY handler.py /opt/acestep/handler.py

ENV ACESTEP_API_HOST=127.0.0.1 \
    ACESTEP_API_PORT=8001 \
    ACESTEP_CONFIG_PATH=acestep-v15-xl-turbo \
    ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0.6B \
    ACESTEP_LM_BACKEND=pt \
    ACESTEP_DEVICE=auto \
    ACESTEP_NO_INIT=false \
    ACESTEP_CHECKPOINTS_DIR=/runpod-volume/checkpoints \
    HF_HOME=/runpod-volume/huggingface

# Notes on the defaults above:
#   ACESTEP_CONFIG_PATH   xl-turbo is the 4B DiT (~9GB bf16), 8 steps, best
#                         audio quality. Swap to acestep-v15-turbo (2B, ~4.7GB)
#                         from the endpoint env vars -- no rebuild needed.
#   ACESTEP_LM_BACKEND    `pt` rather than `vllm`: vllm is faster under load but
#                         starts far slower, which is the wrong trade on a
#                         serverless cold start.
#   ACESTEP_NO_INIT       false loads the models at boot rather than on the
#                         first request. Lazy loading costs ~80s *inside* the
#                         job, eating the caller's timeout budget. Note this is
#                         the real variable -- ACESTEP_INIT_SERVICE is ignored.

# Ejecutar el intérprete del venv directamente, NO `uv run`.
#
# `uv run` re-resuelve el entorno en cada arranque, y esa resolución intenta
# descargar flash-attn desde una URL directa de GitHub -- un wheel de Windows,
# en un contenedor Linux. Con UV_HTTP_TIMEOUT en 30s la descarga se pasaba y el
# worker moría con "exit code 2" antes de que Python llegara a correr:
#
#   error: Failed to generate package metadata for `flash-attn==2.8.2 @ direct+...
#   Caused by: Failed to download distribution due to network timeout
#   worker exited with exit code 2
#
# Como dependía de la red, fallaba de forma intermitente: RunPod veía la cola
# sin drenar, levantaba más workers, y todos morían igual. Las dependencias ya
# quedaron instaladas por `uv sync --frozen` durante el build, así que en
# runtime no hay nada que resolver.
ENV PATH="/opt/acestep/.venv/bin:${PATH}"

CMD ["python", "-u", "handler.py"]
