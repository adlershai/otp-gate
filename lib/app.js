const http = require('http')
const { URL } = require('url')
const { smsPageHtml } = require('./smsPage')
const { readSession, sessionCookie, basicUsername } = require('./session')

function pmaTarget() {
  return {
    hostname: process.env.PMA_HOST || '127.0.0.1',
    port: Number(process.env.PMA_PORT || 8765)
  }
}

function isPassthrough() {
  const v = String(process.env.OTP_PASSTHROUGH || '1').toLowerCase()
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

function interceptUntilOtp(req, res) {
  const target = pmaTarget()
  const headers = { ...req.headers }
  headers.host = `${target.hostname}:${target.port}`
  const upstream = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: '/',
      method: 'GET',
      headers
    },
    (pres) => {
      if (pres.statusCode === 401 || pres.statusCode === 407) {
        res.writeHead(pres.statusCode, pres.headers)
        pres.pipe(res)
        return
      }
      pres.resume()
      const html = smsPageHtml()
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      })
      res.end(html)
    }
  )
  upstream.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('phpMyAdmin unreachable')
  })
  upstream.end()
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

async function handleRequest(req, res) {
  const url = new URL(req.url, 'http://otp-gate.local')

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  if (req.method === 'POST' && url.pathname === '/verify') {
    await parseBody(req)
    if (!isPassthrough()) {
      res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(smsPageHtml({ error: 'Real SMS verification is not enabled yet' }))
      return
    }
    const username = basicUsername(req) || 'pbphp'
    res.writeHead(302, {
      Location: '/',
      'Set-Cookie': sessionCookie({ u: username, t: Date.now(), pass: true })
    })
    res.end()
    return
  }

  const session = readSession(req)
  if (session && session.u) {
    proxyToPma(req, res)
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(302, { Location: '/' })
    res.end()
    return
  }

  interceptUntilOtp(req, res)
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
