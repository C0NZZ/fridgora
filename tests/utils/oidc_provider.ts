import { createHash, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { exportJWK, generateKeyPair, SignJWT } from 'jose'

export const oidcTestPort = 3355
export const oidcClientId = 'fridgora-test'
export const oidcClientSecret = 'fridgora-test-secret'

/** A local provider with a stable subject and no email claim. */
export async function startOidcProvider(port = 0) {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const keyId = 'test-oidc-key'
  const publicJwk = { ...(await exportJWK(publicKey)), kid: keyId, alg: 'RS256', use: 'sig' }
  const codes = new Map<string, { nonce: string; challenge: string; redirectUri: string }>()
  let issuer = ''

  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, issuer)
    const json = (body: object, status = 200) => {
      response.writeHead(status, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(body))
    }

    if (url.pathname === '/.well-known/openid-configuration') {
      return json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        id_token_signing_alg_values_supported: ['RS256'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      })
    }

    if (url.pathname === '/jwks') return json({ keys: [publicJwk] })

    if (url.pathname === '/authorize') {
      const code = randomUUID()
      const nonce = url.searchParams.get('nonce')
      const challenge = url.searchParams.get('code_challenge')
      const redirectUri = url.searchParams.get('redirect_uri')
      const state = url.searchParams.get('state')
      if (
        !nonce ||
        !challenge ||
        !redirectUri ||
        !state ||
        url.searchParams.get('code_challenge_method') !== 'S256'
      ) {
        return json({ error: 'invalid_request' }, 400)
      }
      codes.set(code, { nonce, challenge, redirectUri })
      const callback = new URL(redirectUri)
      callback.searchParams.set('code', code)
      callback.searchParams.set('state', state)
      response.writeHead(302, { Location: callback.href }).end()
      return
    }

    if (url.pathname === '/token' && request.method === 'POST') {
      let body = ''
      for await (const chunk of request) body += chunk.toString()
      const params = new URLSearchParams(body)
      const code = params.get('code') ?? ''
      const saved = codes.get(code)
      codes.delete(code)
      const verifier = params.get('code_verifier') ?? ''
      const challenge = createHash('sha256').update(verifier).digest('base64url')
      if (
        !saved ||
        saved.challenge !== challenge ||
        saved.redirectUri !== params.get('redirect_uri')
      ) {
        return json({ error: 'invalid_grant' }, 400)
      }
      const authorization = request.headers.authorization
      const credentials = authorization?.startsWith('Basic ')
        ? Buffer.from(authorization.slice(6), 'base64')
            .toString('utf8')
            .split(':')
            .map((value) => decodeURIComponent(value.replaceAll('+', ' ')))
        : [params.get('client_id'), params.get('client_secret')]
      if (credentials[0] !== oidcClientId || credentials[1] !== oidcClientSecret) {
        return json({ error: 'invalid_client' }, 401)
      }
      const token = await new SignJWT({
        nonce: saved.nonce,
        name: 'OIDC Test Customer',
        auth_time: Math.floor(Date.now() / 1000),
      })
        .setProtectedHeader({ alg: 'RS256', kid: keyId })
        .setIssuer(issuer)
        .setAudience(oidcClientId)
        .setSubject('test-identity-without-email')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey)
      return json({ access_token: 'test-access-token', token_type: 'Bearer', id_token: token })
    }

    return json({ error: 'not_found' }, 404)
  })

  server.listen(port, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('OIDC test server did not bind')
  issuer = `http://127.0.0.1:${address.port}`
  return {
    issuer,
    async close() {
      server.close()
      server.closeAllConnections()
      await once(server, 'close')
    },
  }
}
