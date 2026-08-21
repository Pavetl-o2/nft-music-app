# ACE-Step 1.5 as a RunPod Serverless worker.
#
# Model weights are NOT baked in (~15GB). They download on first boot into
# HF_HOME, which points at the mounted network volume so they persist across
# workers and cold starts. Keeps the image small enough to build on the free
# GitHub Actions runners.

FROM nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        ffmpeg \
        libsndfile1 \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# uv manages both the Python runtime and the dependencies. ACE-Step 1.5
# requires Python 3.11-3.12; Ubuntu 22.04 ships 3.10, so let uv provide it.
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:${PATH}"

WORKDIR /opt
RUN git clone --depth 1 https://github.com/ace-step/ACE-Step-1.5.git acestep

WORKDIR /opt/acestep
RUN uv python install 3.11 \
    && uv sync --no-dev

# RunPod SDK + requests live in the same venv as ACE-Step so `uv run` sees them.
RUN uv pip install runpod requests

COPY handler.py /opt/acestep/handler.py

ENV ACESTEP_API_HOST=127.0.0.1 \
    ACESTEP_API_PORT=8001 \
    ACESTEP_CONFIG_PATH=acestep-v15-turbo \
    ACESTEP_LM_MODEL_PATH=acestep-5Hz-lm-0.6B \
    ACESTEP_LM_BACKEND=pt \
    ACESTEP_DEVICE=auto \
    HF_HOME=/runpod-volume/huggingface \
    HF_HUB_ENABLE_HF_TRANSFER=1

# `pt` instead of `vllm` on purpose: vllm adds a large dependency and a long
# startup, which is exactly what you do not want on a serverless cold start.
# Switch to vllm via the endpoint env vars if throughput matters more.

CMD ["uv", "run", "python", "-u", "handler.py"]
