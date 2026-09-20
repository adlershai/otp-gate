const { createServer } = require('./lib/app')

const port = Number(process.env.PORT || 8777)
createServer().listen(port, '127.0.0.1', () => {
  process.stdout.write(`otp-gate listening on 127.0.0.1:${port}\n`)
})
