const SYSTEM = 'pma'

/** @type {{ fetchFn?: typeof fetch }} */
let deps = {}

function setCrmOtpDeps(next = {}) {
  deps = next && typeof next === 'object' ? next : {}
}

function getFetch() {
  return deps.fetchFn || globalThis.fetch
}

/**
 * @param {'adminSmsOtpSend'|'adminSmsOtpVerify'} type
 * @param {Record<string, string>} params
 */
async function crmCall(type, params) {
  const token = String(process.env.ADMIN_OTP_TOKEN || '').trim()
  if (!token) {
    return { ok: false, error: 'SMS login failed' }
  }

  const base = String(process.env.CRM_API_URL || 'https://crm.adler-backend.com').replace(/\/$/, '')
  const url = `${base}/api/1/common`
  let res
  try {
    res = await getFetch()(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Otp-Token': token
      },
      body: JSON.stringify({ type, params }),
      signal: AbortSignal.timeout(20000)
    })
  } catch {
    return { ok: false, error: 'SMS login failed' }
  }

  if (!res || res.status >= 500) {
    return { ok: false, error: 'SMS login failed' }
  }

  let decoded
  try {
    decoded = await res.json()
  } catch {
    return { ok: false, error: 'SMS login failed' }
  }

  if (!decoded || typeof decoded !== 'object') {
    return { ok: false, error: 'SMS login failed' }
  }
  return decoded
}

function sendOtp(username) {
  return crmCall('adminSmsOtpSend', {
    system: SYSTEM,
    username: String(username || '')
  })
}

function verifyOtp(username, code) {
  return crmCall('adminSmsOtpVerify', {
    system: SYSTEM,
    username: String(username || ''),
    code: String(code || '')
  })
}

module.exports = { sendOtp, verifyOtp, setCrmOtpDeps, SYSTEM }
