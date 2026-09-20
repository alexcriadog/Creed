#!/usr/bin/env bash
# Sube las variables de entorno de PRODUCCIÓN a Vercel (leyéndolas de apps/web/.env.local,
# sección cloud) y despliega apps/web. No contiene secretos.
#
# Uso:
#   npx vercel login                       # una vez, interactivo
#   cd apps/web && npx vercel link         # una vez, elegir el proyecto existente
#   scripts/deploy-vercel.sh https://<dominio>.vercel.app
#
# El dominio se conoce tras `vercel link` (Settings → Domains) o tras un primer `vercel --prod`.
set -euo pipefail

DOMAIN="${1:?Uso: scripts/deploy-vercel.sh https://<dominio>.vercel.app}"
DOMAIN="${DOMAIN%/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/apps/web/.env.local"

val() {
  local v
  v="$(grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
  v="${v%\"}"; v="${v#\"}"
  if [ -z "$v" ]; then echo "Falta $1 en $ENV_FILE" >&2; exit 1; fi
  printf '%s' "$v"
}

set_env() {
  # vercel env add lee el valor de stdin; --force sobrescribe si ya existe.
  printf '%s' "$2" | npx vercel env add "$1" production --force >/dev/null
  echo "  ✓ $1"
}

cd "$ROOT/apps/web"
echo "Subiendo env vars de producción a Vercel…"
set_env NEXT_PUBLIC_SUPABASE_URL      "$(val SUPABASE_CLOUD_URL)"
set_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$(val SUPABASE_CLOUD_PUBLISHABLE_KEY)"
set_env SUPABASE_SECRET_KEY           "$(val SUPABASE_CLOUD_SECRET_KEY)"
set_env NEXT_PUBLIC_APP_URL           "$DOMAIN"
set_env WHOOP_CLIENT_ID               "$(val WHOOP_CLIENT_ID)"
set_env WHOOP_CLIENT_SECRET           "$(val WHOOP_CLIENT_SECRET)"
set_env WHOOP_REDIRECT_URI            "$DOMAIN/api/whoop/callback"
set_env WHOOP_TOKEN_ENCRYPTION_KEY    "$(val WHOOP_TOKEN_ENCRYPTION_KEY)"
set_env WHOOP_WEBHOOK_SECRET          "$(val WHOOP_WEBHOOK_SECRET)"
set_env CRON_SECRET                   "$(val CRON_SECRET)"
set_env ADMIN_EMAILS                  "$(val ADMIN_EMAILS)"
# Legado (coach viejo): vacías para que el build no falle si algo las lee.
set_env ANTHROPIC_API_KEY             "$(val ANTHROPIC_API_KEY)"
set_env GROQ_API_KEY                  "$(val GROQ_API_KEY)"

echo "Desplegando a producción…"
npx vercel --prod

cat <<MSG

Siguientes pasos (manuales):
  1. Supabase → Authentication → URL Configuration: Site URL = $DOMAIN ; Redirect URLs += $DOMAIN/**
     (y actualizar [remotes.creed.auth] en supabase/config.toml con el mismo valor)
  2. developer.whoop.com → redirect URI: $DOMAIN/api/whoop/callback
  3. $DOMAIN/whoop → Conectar Whoop
  4. claude.ai → Settings → Connectors → Add custom connector → $DOMAIN/api/mcp
Comprobación: curl $DOMAIN/.well-known/oauth-protected-resource
MSG
