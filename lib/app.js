const http = require('http')
const { URL } = require('url')
const { smsPageHtml } = require('./smsPage')
const { readSession, sessionCookie, basicUsername } = require('./session')
const { sendOtp, verifyOtp } = require('./crmOtp')

function pmaTarget() {
  return {
    hostname: process.env.PMA_HOST || '127.0.0.1',
    port: Number(process.env.PMA_PORT || 8765)
  }
}

function isPassthrough() {
  const v = String(process.env.OTP_PASSTHROUGH || '0').toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

function proxyToPma(req, res) {
  const target = pmaTarget()
  const headers = { ...req.headers }
  headers.host = `${target.hostname}:${target.port}`
  const upstream = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: req.url,
      method: req.method,
      headers
    },
    (pres) => {
      res.writeHead(pres.statusCode, pres.headers)
      pres.pipe(res)
    }
  )
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('phpMyAdmin unreachable')
  })
  req.pipe(upstream)
}

function probePma(req) {
  const target = pmaTarget()
  const headers = { ...req.headers }
  headers.host = `${target.hostname}:${target.port}`
  return new Promise((resolve, reject) => {
    const upstream = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: '/',
        method: 'GET',
        headers
      },
      (pres) => resolve(pres)
    )
    upstream.on('error', reject)
    upstream.end()
  })
}

function writeSms(res, error, channel = 'sms') {
  const html = smsPageHtml({ error, channel })
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  res.end(html)
}

function writeBasicChallenge(res, pres) {
  res.writeHead(pres.statusCode, pres.headers)
  pres.pipe(res)
}

async function afterBasicOk(req, res, { resend = false, channel = 'sms' } = {}) {
  const username = basicUsername(req)
  if (!username) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Restricted Content"' })
    res.end('Unauthorized')
    return
  }

  if (!isPassthrough()) {
    const sent = await sendOtp(username, channel)
    if (sent && sent.skip) {
      writeSms(res, 'SMS login is not enabled for this user', channel)
      return
    }
    if (!sent || sent.ok !== true) {
      writeSms(res, (sent && sent.error) || 'SMS login failed', channel)
      return
    }
  }

  writeSms(res, '', channel)
}

async function interceptUntilOtp(req, res, { resend = false, channel = 'sms' } = {}) {
  let pres
  try {
    pres = await probePma(req)
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('phpMyAdmin unreachable')
    return
  }

  if (pres.statusCode === 401 || pres.statusCode === 407) {
    writeBasicChallenge(res, pres)
    return
  }

  pres.resume()
  await afterBasicOk(req, res, { resend, channel })
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      resolve(new URLSearchParams(raw))
    })
    req.on('error', reject)
  })
}

function grantSession(res, username) {
  res.writeHead(302, {
    Location: '/',
    'Set-Cookie': sessionCookie({ u: username, t: Date.now(), pass: true })
  })
  res.end()
}

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://otp-gate.local')

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  if (req.method === 'POST' && url.pathname === '/verify') {
    const body = await parseBody(req)
    const username = basicUsername(req)
    if (!username) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Restricted Content"' })
      res.end('Unauthorized')
      return
    }

    if (isPassthrough()) {
      grantSession(res, username)
      return
    }

    const verified = await verifyOtp(username, body.get('code') || '')
    if (!verified || verified.ok !== true) {
      writeSms(res, (verified && verified.error) || 'Invalid or expired code')
      return
    }

    grantSession(res, username)
    return
  }

  const session = readSession(req)
  if (session && session.u) {
    proxyToPma(req, res)
    return
  }

  if (req.method === 'GET' && url.pathname === '/resend') {
    await interceptUntilOtp(req, res, { resend: true, channel: 'sms' })
    return
  }

  if (req.method === 'GET' && url.pathname === '/email') {
    await interceptUntilOtp(req, res, { resend: true, channel: 'email' })
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(302, { Location: '/' })
    res.end()
    return
  }

  if (url.pathname !== '/' && url.pathname !== '/index.php') {
    res.writeHead(302, { Location: '/' })
    res.end()
    return
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, { 'Cache-Control': 'no-store' })
    res.end()
    return
  }

  await interceptUntilOtp(req, res)
}

function createServer() {
  return http.createServer((req, res) => {
    Promise.resolve(handleRequest(req, res)).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
      }
      res.end('otp-gate error')
    })
  })
}

module.exports = { createServer, handleRequest, isPassthrough }
