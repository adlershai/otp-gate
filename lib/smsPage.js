function smsPageHtml({ error = '' } = {}) {
  const err = error
    ? `<p class="error">${escapeHtml(error)}</p>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SMS code</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; }
    .box { max-width: 360px; margin: 8% auto; background: #fff; padding: 28px 24px; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,.08); }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { color: #555; font-size: 14px; }
    label { display: block; font-size: 13px; margin: 16px 0 6px; }
    input { width: 100%; box-sizing: border-box; padding: 10px; font-size: 18px; letter-spacing: 4px; text-align: center; }
    button { width: 100%; margin-top: 16px; padding: 12px; border: 0; background: #1a73a8; color: #fff; font-size: 15px; cursor: pointer; }
    .error { color: #b00020; }
  </style>
</head>
<body>
  <div class="box">
    <h1>SMS code</h1>
    <p>Code sent to your mobile</p>
    ${err}
    <form method="post" action="/verify">
      <label for="code">6-digit code</label>
      <input id="code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" autofocus>
      <button type="submit">Verify</button>
    </form>
  </div>
</body>
</html>`
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = { smsPageHtml }
