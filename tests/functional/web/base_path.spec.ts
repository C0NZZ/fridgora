import '#tests/test_context'
import { test } from '@japa/runner'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { createServer, type AddressInfo } from 'node:net'
import { getTestRuntimeEnv } from '#tests/utils/test_db'

test('serves only the configured mount and keeps kiosk redirects under it', async ({
  assert,
  cleanup,
}) => {
  const host = '127.0.0.1'
  const socket = createServer().listen(0, host)
  await once(socket, 'listening')
  const { port } = socket.address() as AddressInfo
  const closed = once(socket, 'close')
  socket.close()
  await closed

  const origin = `http://${host}:${port}`
  const app = fork('bin/server.ts', {
    execArgv: ['--import', '@poppinss/ts-exec'],
    env: getTestRuntimeEnv({
      HOST: host,
      PORT: String(port),
      APP_URL: origin,
      APP_BASE_PATH: '/office/fridgora/',
    }),
  })
  cleanup(async () => {
    if (app.exitCode === null && app.signalCode === null) {
      const exited = once(app, 'exit')
      app.kill()
      await exited
    }
  })
  const signal = AbortSignal.timeout(10_000)
  await Promise.race([
    once(app, 'message', { signal }),
    once(app, 'exit', { signal }).then(([code]) => {
      throw new Error(`Mounted test server exited during startup (code ${code})`)
    }),
  ])

  const request = (path: string, headers?: Record<string, string>) =>
    fetch(origin + path, { redirect: 'manual', headers })

  const root = await request('/office/fridgora?lang=en')
  assert.equal(root.status, 308)
  assert.equal(root.headers.get('location'), '/office/fridgora/?lang=en')

  const kiosk = await request('/office/fridgora/kiosk', { Accept: 'text/html' })
  assert.equal(kiosk.status, 302)
  assert.equal(kiosk.headers.get('location')?.split('?')[0], '/office/fridgora/login')
  const unmounted = await request('/kiosk')
  const similarPath = await request('/office/fridgora-other/kiosk')
  const tone = await request('/office/fridgora/keypad/1.wav')
  const health = await request('/api/v1/health')
  assert.equal(unmounted.status, 404)
  assert.equal(similarPath.status, 404)
  assert.equal(tone.status, 200)
  assert.equal(health.status, 200)

  const manifest = await request('/office/fridgora/site.webmanifest')
  assert.equal(manifest.status, 200)
  const body = await manifest.json()
  assert.equal(body.start_url, '/office/fridgora/')
  assert.equal(body.scope, '/office/fridgora/')
  assert.equal(body.icons[0].src, '/office/fridgora/favicon.svg')

  const staleVisit = await request('/office/fridgora/?lang=en', {
    'X-Inertia': 'true',
    'X-Inertia-Version': 'stale',
  })
  assert.equal(staleVisit.status, 409)
  assert.equal(staleVisit.headers.get('x-inertia-location'), '/office/fridgora/?lang=en')
})
