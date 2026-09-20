const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const { encodeSession, decodeSession, sessionCookie } = require('../lib/session')

process.env.COOKIE_SECRET = 'test-cookie-secret-16'
process.env.OTP_PASSTHROUGH = '1'

describe('session cookie', () => {
  it('round-trips a signed payload', () => {
    const token = encodeSession({ u: 'pbphp', pass: true })
    assert.equal(decodeSession(token).u, 'pbphp')
    assert.equal(decodeSession('tampered.' + token.split('.')[1]), null)
  })

  it('sets httpOnly Secure cookie', () => {
    const header = sessionCookie({ u: 'pbphp' })
    assert.match(header, /HttpOnly/)
    assert.match(header, /Secure/)
    assert.match(header, /otp_gate=/)
  })
})

describe('passthrough verify', () => {
  it('sets a cookie and redirects without checking the code', async () => {
    const { createServer } = require('../lib/app')
    const pma = http.createServer((req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Restricted Content"' })
      res.end('auth')
    })
    await new Promise((resolve) => pma.listen(0, '127.0.0.1', resolve))
    process.env.PMA_PORT = String(pma.address().port)
    process.env.PMA_HOST = '127.0.0.1'

    const gate = createServer()
    await new Promise((resolve) => gate.listen(0, '127.0.0.1', resolve))
    const port = gate.address().port
    const res = await fetch(`http://127.0.0.1:${port}/verify`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from('pbphp:x').toString('base64') },
      body: 'code=000000',
      redirect: 'manual'
    })
    assert.equal(res.status, 302)
    assert.match(res.headers.get('set-cookie') || '', /otp_gate=/)
    gate.close()
    pma.close()
  })
})
