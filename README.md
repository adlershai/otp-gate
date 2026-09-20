# otp-gate

Front door for **phpMyAdmin** at `https://pma.adler-backend.com/`. Separate repo from CRM, shop, and orders.

Do not put Cellact keys here. CRM sends the SMS.

## Flow

1. Browser opens `https://pma.adler-backend.com/`.
2. Existing PMA HTTP Basic popup (`pbphp` / htpasswd inside the Docker container).
3. After Basic succeeds, **otp-gate** asks CRM to SMS a code (`system=pma`) and shows the code page.
4. Verify → CRM `adminSmsOtpVerify` → cookie `otp_gate`.
5. Gate proxies to phpMyAdmin on `127.0.0.1:8765`.

`OTP_PASSTHROUGH=1` skips CRM (screen-only). Production uses `0`.

## Local

```bash
cp .env.example .env
# set COOKIE_SECRET and ADMIN_OTP_TOKEN
node --test
node server.js
```

Listens on `127.0.0.1:8777` by default.

## Production (Adler)

See `docs/deploy.md`. Checkout: `/home/ubuntu/otp-gate`. Service: `otp-gate.service`. Node 20 from nvm, same as CRM.
