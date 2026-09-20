const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const { encodeSession, decodeSession, sessionCookie } = require('../lib/session')
const { setCrmOtpDeps } = require('../lib/crmOtp')

process.env.COOKIE_SECRET = 'test-cookie-secret-16'
process.env.ADMIN_OTP_TOKEN = 'test-admin-otp-token-32chars!!'
process.env.CRM_API_URL = 'http://127.0.0.1:9'
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

async function listen(server) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return server.address().port
}

function startPma(handler) {
  const pma = http.createServer(handler)
  return pma
}

describe('passthrough verify', () => {
  it('sets a cookie and redirects without checking the code', async () => {
    process.env.OTP_PASSTHROUGH = '1'
    const { createServer } = require('../lib/app')
    const pma = startPma((_req, res) => {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Restricted Content"' })
      res.end('auth')
    })
    process.env.PMA_PORT = String(await listen(pma))
    process.env.PMA_HOST = '127.0.0.1'

    const gate = createServer()
    const port = await listen(gate)
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

describe('real SMS verify', () => {
  beforeEach(() => {
    process.env.OTP_PASSTHROUGH = '0'
    setCrmOtpDeps({})
  })
  afterEach(() => {
    process.env.OTP_PASSTHROUGH = '1'
    setCrmOtpDeps({})
  })

  it('rejects a wrong code and does not set a cookie', async () => {
    setCrmOtpDeps({
      fetchFn: async () => ({
        status: 200,
        json: async () => ({ ok: false, error: 'Invalid or expired code' })
      })
    })
    const { createServer } = require('../lib/app')
    const pma = startPma((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('pma')
    })
    process.env.PMA_PORT = String(await listen(pma))
    process.env.PMA_HOST = '127.0.0.1'
    const gate = createServer()
    const port = await listen(gate)
    const res = await fetch(`http://127.0.0.1:${port}/verify`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from('pbphp:x').toString('base64') },
      body: 'code=000000',
      redirect: 'manual'
    })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('set-cookie'), null)
    assert.match(await res.text(), /Invalid or expired code/)
    gate.close()
    pma.close()
  })

  it('sets a cookie after CRM verify succeeds', async () => {
    const calls = []
    setCrmOtpDeps({
      fetchFn: async (_url, opts) => {
        calls.push(JSON.parse(opts.body))
        return { status: 200, json: async () => ({ ok: true }) }
      }
    })
    const { createServer } = require('../lib/app')
    const pma = startPma((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('pma')
    })
    process.env.PMA_PORT = String(await listen(pma))
    process.env.PMA_HOST = '127.0.0.1'
    const gate = createServer()
    const port = await listen(gate)
    const res = await fetch(`http://127.0.0.1:${port}/verify`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from('pbphp:x').toString('base64') },
      body: 'code=123456',
      redirect: 'manual'
    })
    assert.equal(res.status, 302)
    assert.match(res.headers.get('set-cookie') || '', /otp_gate=/)
    assert.equal(calls[0].type, 'adminSmsOtpVerify')
    assert.equal(calls[0].params.system, 'pma')
    assert.equal(calls[0].params.username, 'pbphp')
    assert.equal(calls[0].params.code, '123456')
    gate.close()
    pma.close()
  })
})
