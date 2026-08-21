"""RunPod Serverless handler for ACE-Step 1.5.

Design: the ACE-Step API server is a normal HTTP service, so instead of
reimplementing inference we boot `acestep-api` on localhost inside the
container and forward jobs to it. That reuses the exact request flow the
app already debugged against the pod (see ACESTEP.md).

Flow per job:
    POST /release_task      -> task_id
    POST /query_result      -> poll until status 1 (ok) or 2 (failed)
    GET  /v1/audio?path=... -> audio bytes -> base64 in the JSON response
"""

import base64
import json
import os
import subprocess
import sys
import threading
import time

import requests
import runpod

API_HOST = os.environ.get("ACESTEP_API_HOST", "127.0.0.1")
API_PORT = int(os.environ.get("ACESTEP_API_PORT", "8001"))
BASE_URL = f"http://{API_HOST}:{API_PORT}"

# The first boot downloads ~15GB of weights into the network volume, so the
# health check needs a generous window. Later cold starts hit the cache.
BOOT_TIMEOUT = int(os.environ.get("WORKER_BOOT_TIMEOUT", "1800"))
JOB_TIMEOUT = int(os.environ.get("WORKER_JOB_TIMEOUT", "900"))
POLL_INTERVAL = float(os.environ.get("WORKER_POLL_INTERVAL", "3"))

SERVER_CMD = os.environ.get("ACESTEP_SERVER_CMD", "acestep-api").split()

_server_proc = None
_boot_lock = threading.Lock()
_booted = False


def _log(msg):
    print(f"[worker] {msg}", flush=True)


def _spawn_server():
    """Start the ACE-Step API server as a child process (once)."""
    global _server_proc

    if _server_proc is not None and _server_proc.poll() is None:
        return

    env = os.environ.copy()
    env["ACESTEP_API_HOST"] = API_HOST
    env["ACESTEP_API_PORT"] = str(API_PORT)

    _log(f"starting ACE-Step API server: {' '.join(SERVER_CMD)}")
    _server_proc = subprocess.Popen(
        SERVER_CMD,
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )


def _wait_until_healthy():
    """Block until GET /health answers, or raise."""
    deadline = time.time() + BOOT_TIMEOUT
    last_error = None
    announced = False

    while time.time() < deadline:
        if _server_proc is not None and _server_proc.poll() is not None:
            raise RuntimeError(
                f"ACE-Step API server exited during boot with code {_server_proc.returncode}"
            )

        try:
            res = requests.get(f"{BASE_URL}/health", timeout=5)
            if res.ok:
                _log("ACE-Step API server is healthy")
                return
        except requests.RequestException as exc:
            last_error = exc

        if not announced:
            _log("waiting for ACE-Step API server (first boot downloads model weights)...")
            announced = True

        time.sleep(2)

    raise RuntimeError(f"ACE-Step API server did not become healthy in {BOOT_TIMEOUT}s: {last_error}")


def _ensure_server():
    """Idempotent, thread-safe boot."""
    global _booted

    if _booted:
        return

    with _boot_lock:
        if _booted:
            return
        _spawn_server()
        _wait_until_healthy()
        _booted = True


def _release_task(payload):
    res = requests.post(f"{BASE_URL}/release_task", json=payload, timeout=60)
    res.raise_for_status()
    body = res.json()

    task_id = (body.get("data") or {}).get("task_id")
    if not task_id:
        raise RuntimeError(f"release_task returned no task_id: {body}")

    return task_id


def _query_result(task_id):
    """Return the parsed result list once done, None while still running.

    NOTE: the field is `task_id_list` and it is an ARRAY, and `result` comes
    back as a JSON *string*. Both cost a debugging session -- see ACESTEP.md.
    """
    res = requests.post(
        f"{BASE_URL}/query_result",
        json={"task_id_list": [task_id]},
        timeout=30,
    )
    res.raise_for_status()

    items = res.json().get("data") or []
    if not items:
        return None

    first = items[0]
    status = first.get("status")

    if status == 2:
        raise RuntimeError(f"ACE-Step reported the task as failed: {first}")
    if status != 1:
        return None

    try:
        parsed = json.loads(first["result"])
    except (KeyError, TypeError, ValueError) as exc:
        raise RuntimeError(f"could not parse the result field: {exc}") from exc

    if not isinstance(parsed, list) or not parsed:
        raise RuntimeError(f"result was empty: {parsed}")

    return parsed


def _fetch_audio(audio_path):
    """Download the generated audio.

    The `file` field may ALREADY be `/v1/audio?path=...`. Wrapping it a second
    time produces a 403 -- see ACESTEP.md section 3.2.
    """
    if audio_path.startswith(("/v1/", "/api/")):
        res = requests.get(f"{BASE_URL}{audio_path}", timeout=300)
    else:
        res = requests.get(f"{BASE_URL}/v1/audio", params={"path": audio_path}, timeout=300)

    res.raise_for_status()
    return res.content


def handler(job):
    """RunPod entrypoint. `job["input"]` is the ACE-Step payload verbatim."""
    payload = job.get("input") or {}

    if not payload:
        return {"error": "empty input: expected the ACE-Step payload under 'input'"}

    try:
        _ensure_server()
    except Exception as exc:
        return {"error": f"worker boot failed: {exc}"}

    started = time.time()

    try:
        task_id = _release_task(payload)
        _log(f"task {task_id} queued")

        result_items = None
        while time.time() - started < JOB_TIMEOUT:
            time.sleep(POLL_INTERVAL)

            result_items = _query_result(task_id)
            if result_items:
                break

        if not result_items:
            return {
                "error": f"timeout: the task did not finish within {JOB_TIMEOUT}s",
                "task_id": task_id,
            }

        item = result_items[0]
        audio_path = item.get("file")
        if not audio_path:
            return {"error": f"the result carried no audio path: {item}", "task_id": task_id}

        audio = _fetch_audio(audio_path)
        elapsed = round(time.time() - started, 1)
        _log(f"task {task_id} finished in {elapsed}s ({len(audio)} bytes)")

        return {
            "task_id": task_id,
            "audio_base64": base64.b64encode(audio).decode("ascii"),
            "audio_format": payload.get("audio_format", "mp3"),
            "size_bytes": len(audio),
            "seconds": elapsed,
            "metas": item.get("metas"),
            "seed_value": item.get("seed_value"),
            "dit_model": item.get("dit_model"),
            "lm_model": item.get("lm_model"),
        }

    except Exception as exc:
        return {"error": str(exc)}


# Boot the model server while the worker is still initialising, so the first
# real request does not pay for the weight download.
try:
    _ensure_server()
except Exception as exc:  # noqa: BLE001 - surfaced again per-job
    _log(f"eager boot failed, will retry on first job: {exc}")

runpod.serverless.start({"handler": handler})
