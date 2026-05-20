# Architecture (MVP)

## Layers
```
┌────────────────────────────────────────────────────────────┐
│  Next.js (App Router)                                       │
│  • Login • Agent list • Wizard (3 steps) • Chat UI         │
└──────────────────────┬─────────────────────────────────────┘
                       │ JWT Bearer
┌──────────────────────▼─────────────────────────────────────┐
│  FastAPI                                                    │
│  api/    auth · agents · llm · sessions                    │
│  services/  chat · acl · audit                             │
│  providers/ openai · anthropic · openrouter (OAI-compat)   │
│  utils/  pii (egress mask) · crypto (Fernet)               │
└──────────────────────┬─────────────────────────────────────┘
                       │ SQLAlchemy
┌──────────────────────▼─────────────────────────────────────┐
│  PostgreSQL + pgvector                                      │
│  users · roles · groups · resource_acls                    │
│  agents · agent_tools · agent_knowledge                    │
│  llm_providers · llm_models                                │
│  chat_sessions · messages · citations                      │
│  documents · document_versions · document_chunks (vec)     │
│  audit_logs · usage_records                                │
└────────────────────────────────────────────────────────────┘
```

## Implemented (rolling)
- JWT auth, seed superuser (`admin@example.com` / `admin123`)
- Multi-provider LLM Gateway with **Fernet-encrypted** API keys (OpenAI, Anthropic, OpenAI-compatible/OpenRouter/Local)
- Agent CRUD + chat with token + cost tracking
- ACL primitives (user/role/group × view/use/edit/admin)
- PII egress mask (Thai ID, phone, card, email, account)
- Audit log on every mutation + chat
- Next.js 3-step agent wizard + chat UI with citation strip
- Docker compose with pgvector
- **RAG pipeline**: upload (pdf/docx/txt/md/csv) → SHA-256 dedupe → chunk → OpenAI-compat embeddings (1536-dim) → pgvector cosine retrieval → citation rows auto-populated per chat turn
- **Admin UI**: Providers, Models, Knowledge (upload + bind to agents), Users, Cost Dashboard, Audit Log

## Next iterations (not yet wired)
1. **Tool execution**: API-preset framework that turns `agent_tools` into function-calling tool defs (Text-to-SQL via read-only views, HR/Finance internal API presets)
2. **Alembic migrations**: replace `Base.metadata.create_all` with versioned migrations
3. **SSO/SAML/AzureAD**: replace local auth in `auth.py`
4. **Vision/multimodal**: extend `Message.attachments` handling in providers
5. **Streaming chat**: SSE/WebSocket reply stream
6. **Group + role management UI**: currently APIs exist, no UI for assigning
