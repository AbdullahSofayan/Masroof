# Masroof agent + Docker Compose

## Start the demo

1. Copy `.env.example` to `.env`.
2. Set `OPENROUTER_API_KEY` to an OpenRouter API key. The application itself starts without a key, but chat returns HTTP 503 until one is configured.
3. Replace the demo MySQL and JWT secrets before exposing the application.
4. Run `docker compose up --build`.

Open `http://localhost:8080`. The browser talks to the frontend origin only. Nginx forwards `/api/*` to the `api` Compose service and strips the `/api` prefix, so browser CORS configuration is not needed for this deployment.

## HTTPS

For a public hostname whose DNS A/AAAA records point to this host, set `PUBLIC_DOMAIN=masroof.example.com`, expose ports 80 and 443, and run:

```sh
docker compose --profile https up --build -d
```

Caddy obtains and renews a publicly trusted certificate automatically. For local-only use, Caddy's `localhost` certificate is locally trusted only if the client trusts Caddy's local CA. HTTPS is optional and is not required for the local demo.

## Agent data and privacy

- The assistant is read-only. It has no write tools.
- Authorization scope comes from the validated JWT and database user record.
- Employees see only their own expenses; managers see their department; finance administrators see organization-wide data.
- The Chroma index and sync state persist in the `agent_data` Docker volume.
- Knowledge Markdown is sectioned by headings and audience front matter to support chunk-level vector retrieval.
- The default embedding/chat providers are external OpenRouter services. Use synthetic/demo data only with free models. Do not send confidential or personal information to free models. For production, use suitable paid models and provider data-collection controls, and create a database account with SELECT-only privileges.

## Demo user accounts

The repository's current seed function creates expense categories only. It does not create demo users, departments, budgets, or expenses. Register an employee through the application, and seed manager/finance users and sample business data using your own approved demo seed process before demonstrating role-specific tools.

## Development without Compose

Run FastAPI on port 8000 and Vite on port 5173. Vite proxies `/api` to `http://127.0.0.1:8000`. Set `VITE_USE_MOCK=false` and `VITE_API_URL=/api`.
