# Enterprise AI Agent Platform

No-code AI agent platform for internal enterprise use. Built for governance, RBAC, multi-provider LLM routing, and secure data integration.

## Stack
- **Backend**: FastAPI, SQLAlchemy, pgvector, LangChain
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind
- **DB**: PostgreSQL + pgvector
- **Auth**: JWT (Bearer)
- **Infra**: Docker Compose (dev) → Kubernetes-ready

## Modules (MVP)
1. **Auth & RBAC** — users, roles, groups, resource-level ACL
2. **LLM Gateway** — multi-provider (OpenAI, Anthropic, Gemini, OpenRouter, local) with encrypted API keys
3. **Agent Factory** — agent CRUD, system prompt, tool toggles, knowledge bindings
4. **Chat** — multi-modal messages with citations
5. **Knowledge / RAG** — document upload, versioning, lineage, pgvector index
6. **Audit & Cost** — full audit logs, token cost tracking
7. **PII Filter** — egress mask before sending to external LLMs

## Quick start
```bash
cp .env.example .env
docker compose up -d
# backend: http://localhost:8000/docs
# frontend: http://localhost:3000
```

## Layout
```
backend/
  app/
    api/         # routers
    core/        # config, security
    db/          # session, migrations
    models/      # SQLAlchemy models
    schemas/     # pydantic schemas
    services/    # business logic
    providers/   # LLM adapters
    utils/       # helpers (pii, crypto)
frontend/
  app/           # Next.js App Router
  components/    # UI
  lib/           # api client
docker-compose.yml
```
