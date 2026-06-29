# LangAI Family (initial scaffold)

Local-first language learning web app for family use, with:
- Multi-user accounts
- Local LLM feedback with Ollama
- Speech recognition (faster-whisper)
- Pronunciation scoring + progress tracking
- Multi-language support

## Stack

- **Frontend:** React + Vite
- **Backend:** FastAPI + SQLAlchemy
- **Database:** PostgreSQL
- **LLM runtime:** Ollama

## Run with Docker Compose

```bash
./scripts/up.sh
```

O script verifica se ja existe Ollama em `localhost:11434`:
- Se existir, sobe `db + backend + frontend` e aponta o backend para `http://host.docker.internal:11434`.
- Se nao existir, sobe tambem o servico `ollama` deste compose.

Pull a default model in Ollama:

```bash
docker compose exec ollama ollama pull llama3.2:3b
```

Access:
- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

Admin:
- O primeiro usuário registrado recebe perfil de administrador automaticamente.
- Administrador vê no frontend os menus de **Logs** e **Usuários**.

## Core API endpoints

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/token`
- `GET /api/v1/users/me`
- `GET /api/v1/users/me/progress`
- `GET /api/v1/languages`
- `POST /api/v1/practice/evaluate` (text mode)
- `POST /api/v1/practice/evaluate-audio` (audio mode)

## Project layout

```text
backend/
  app/
    routers/
    services/
frontend/
docker-compose.yml
```

## Notes

- This is an initial architecture scaffold.
- Pronunciation scoring is currently heuristic (token/similarity based), with LLM feedback generation on top.
- Next step is improving phoneme-level analysis and adding lesson/content management.
