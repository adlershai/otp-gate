# Deploy otp-gate (Adler)

| | |
|---|---|
| Host | `3.71.237.152` (Adler) |
| SSH | `ubuntu`, PuTTY session `step`, key `C:\Users\LENOVO\.ssh\crmFilezilla.ppk` |
| Repo | `/home/ubuntu/otp-gate` |
| Listen | `127.0.0.1:8777` |
| PMA | still `127.0.0.1:8765` (Docker) |
| Public URL | `https://pma.adler-backend.com/` |

Do **not** mix this with `step-addons` or `pretty-crm-api` deploy scripts.

## First install

```bash
cd /home/ubuntu
git clone https://github.com/adlershai/otp-gate.git
cd otp-gate
cp .env.example .env
# edit COOKIE_SECRET (16+ chars). Leave OTP_PASSTHROUGH=1 for now.
sudo cp ops/otp-gate.service /etc/systemd/system/otp-gate.service
sudo systemctl daemon-reload
sudo systemctl enable --now otp-gate.service
```

Backup nginx, then point the `pma.adler-backend.com` `location /` at `http://127.0.0.1:8777` (see `ops/nginx-pma.conf.snippet`). `nginx -t` then reload.

## Updates

```bash
cd /home/ubuntu/otp-gate
git pull --ff-only
sudo systemctl restart otp-gate.service
```

No `npm install` until a `package.json` dependency is added.

## Rollback

Restore the previous `pma.adler-backend.com` server block (`proxy_pass http://127.0.0.1:8765`) and `sudo systemctl stop otp-gate.service`.
