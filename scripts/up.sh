#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if curl --silent --fail --max-time 2 "http://localhost:11434/api/tags" >/dev/null; then
  echo "Ollama detectado em localhost:11434. Subindo stack sem o servico ollama do compose."
  OLLAMA_URL="${OLLAMA_URL:-http://host.docker.internal:11434}" \
    docker compose up --build -d db backend frontend
else
  echo "Ollama nao detectado em localhost:11434. Subindo stack completa com ollama local."
  docker compose up --build -d db ollama backend frontend
fi
