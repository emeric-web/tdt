#!/usr/bin/env bash
# Résume les erreurs de l'application dans les logs Docker des dernières 24 h.
# Usage : scripts/log-summary.sh [service] [durée]   (défaut : app 24h)
set -euo pipefail

service="${1:-app}"
since="${2:-24h}"

logs="$(docker compose logs --no-color --no-log-prefix --since "$since" "$service" 2>&1)"

total=$(printf '%s\n' "$logs" | grep -c . || true)
errors=$(printf '%s\n' "$logs" | grep -ciE 'error|⨯' || true)

if [ "$total" -gt 0 ]; then
  rate=$(awk -v e="$errors" -v t="$total" 'BEGIN { printf "%.1f", e * 100 / t }')
else
  rate="0.0"
fi

echo "Service          : $service"
echo "Période          : dernières $since"
echo "Lignes de log    : $total"
echo "Lignes d'erreur  : $errors"
echo "Taux d'erreurs   : $rate %"

if [ "$errors" -gt 0 ]; then
  echo
  echo "Erreurs les plus fréquentes :"
  printf '%s\n' "$logs" | grep -iE 'error|⨯' | sort | uniq -c | sort -rn | head -n 5
fi
