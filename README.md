# otp-gate

Front door for **phpMyAdmin** at `https://pma.adler-backend.com/`. Separate repo from CRM, shop, and orders.

This first cut is a **passthrough**: you still log in with Apache Basic (`pbphp`), then you see the SMS screen, then **Verify** sets a cookie with no CRM/Cellact check, then phpMyAdmin opens as today.

Real SMS verification comes next. Do not put Cellact keys here.

## Flow (passthrough)

1. Browser opens `https://pma.adler-backend.com/`.
2. Existing PMA HTTP Basic popup (`pbphp` / htpasswd inside the Docker container).
3. After Basic succeeds, **otp-gate** shows the SMS code page instead of PMA.
4. Click **Verify** (code is ignored). Cookie `otp_gate` is set.
5. nginx/gate then proxies to phpMyAdmin on `127.0.0.1:8765`.

## Local

```bash
cp .env.example .env
# set COOKIE_SECRET
node --test
node server.js
```

Listens on `127.0.0.1:8777` by default.

## Production (Adler)

See `docs/deploy.md`. Checkout: `/home/ubuntu/otp-gate`. Service: `otp-gate.service`. Node 20 from nvm, same as CRM.
