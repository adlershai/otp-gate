const crypto = require('crypto')

const COOKIE_NAME = 'otp_gate'

function cookieSecret() {
  const secret = String(process.env.COOKIE_SECRET || '')
  if (secret.length < 16) {
    throw new Error('COOKIE_SECRET must be at least 16 characters')
  }
  return secret
}

function sign(value) {
  return crypto.createHmac('sha256', cookieSecret()).update(value).digest('hex')
}

function encodeSession(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${sign(body)}`
}

function decodeSession(token) {
  if (!token || typeof token !== 'string') {
    return null
  }
  const dot = token.lastIndexOf('.')
  if (dot < 1) {
    return null
  }
  const body = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  const expected = sign(body)
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null
  }
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

function parseCookies(header) {
  const out = {}
  String(header || '')
    .split(';')
    .forEach((part) => {
      const idx = part.indexOf('=')
      if (idx < 1) {
        return
      }
      const key = part.slice(0, idx).trim()
      const value = part.slice(idx + 1).trim()
      if (key) {
        out[key] = decodeURIComponent(value)
      }
    })
  return out
}

function readSession(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie)
  return decodeSession(cookies[COOKIE_NAME])
}

function sessionCookie(payload, { maxAgeSec = 12 * 60 * 60 } = {}) {
  const token = encodeSession(payload)
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`
  ]
  return parts.join('; ')
}

function basicUsername(req) {
  const header = String((req.headers && req.headers.authorization) || '')
  if (!header.toLowerCase().startsWith('basic ')) {
    return ''
  }
  try {
    const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8')
    return decoded.split(':', 1)[0] || ''
  } catch {
    return ''
  }
}

module.exports = {
  COOKIE_NAME,
  encodeSession,
  decodeSession,
  readSession,
  sessionCookie,
  basicUsername
}
