import { createHash } from 'node:crypto'
import * as oidc from 'openid-client'
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import { appPath, publicAppUrl } from '#config/base_path'
import app from '@adonisjs/core/services/app'

interface OidcAttempt {
  state: string
  nonce: string
  codeVerifier: string
  startedAt: number
  returnTo: string
}

interface OidcProfile {
  providerUserId: string
  email: string | null
  displayName: string | null
  phone: null
  emailVerifiedClaim: boolean
  returnTo: string
}

const ATTEMPT_COOKIE = 'fridgora-oidc-attempt'
const ATTEMPT_TTL_SECONDS = 10 * 60
const cookieOptions = {
  httpOnly: true,
  secure: app.inProduction,
  sameSite: 'lax',
  path: appPath('/auth/oidc'),
} as const

export default class OidcClientService {
  private configuration?: Promise<oidc.Configuration>

  private callbackUrl() {
    return new URL(
      env.get('AUTH_PROVIDER_OIDC_REDIRECT_URI') || `${publicAppUrl()}/auth/oidc/callback`
    )
  }

  private getConfiguration() {
    const issuer = env.get('AUTH_PROVIDER_OIDC_ISSUER')
    const clientId = env.get('AUTH_PROVIDER_OIDC_CLIENT_ID')
    const clientSecret = env.get('AUTH_PROVIDER_OIDC_CLIENT_SECRET')
    if (!issuer || !clientId || !clientSecret) {
      throw new Error('OpenID Connect requires an issuer, client ID, and client secret')
    }

    const url = new URL(issuer)
    const allowTestHttp =
      env.get('NODE_ENV') === 'test' && url.protocol === 'http:' && url.hostname === '127.0.0.1'

    const clientAuth =
      env.get('AUTH_PROVIDER_OIDC_TOKEN_AUTH_METHOD') === 'client_secret_post'
        ? oidc.ClientSecretPost(clientSecret)
        : oidc.ClientSecretBasic(clientSecret)
    this.configuration ??= oidc
      .discovery(url, clientId, clientSecret, clientAuth, {
        execute: [
          ...(allowTestHttp ? [oidc.allowInsecureRequests] : []),
          oidc.enableNonRepudiationChecks,
        ],
      })
      .catch((error) => {
        this.configuration = undefined
        throw error
      })

    return this.configuration
  }

  async redirect(response: HttpContext['response'], reauthenticate: boolean, returnTo: string) {
    const configuration = await this.getConfiguration()
    const attempt: OidcAttempt = {
      state: oidc.randomState(),
      nonce: oidc.randomNonce(),
      codeVerifier: oidc.randomPKCECodeVerifier(),
      startedAt: Date.now(),
      returnTo,
    }
    const scopes = new Set([
      'openid',
      ...(env.get('AUTH_PROVIDER_OIDC_SCOPES') || 'profile email').trim().split(/\s+/),
    ])
    const authorizationUrl = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: this.callbackUrl().href,
      scope: [...scopes].join(' '),
      state: attempt.state,
      nonce: attempt.nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(attempt.codeVerifier),
      code_challenge_method: 'S256',
      ...(reauthenticate ? { max_age: '0' } : {}),
    })
    response.encryptedCookie(ATTEMPT_COOKIE, attempt, {
      ...cookieOptions,
      maxAge: ATTEMPT_TTL_SECONDS,
    })
    return authorizationUrl.href
  }

  async profile(
    request: HttpContext['request'],
    response: HttpContext['response'],
    reauthenticate: boolean
  ) {
    const attempt = request.encryptedCookie(ATTEMPT_COOKIE) as OidcAttempt | undefined
    response.clearCookie(ATTEMPT_COOKIE, cookieOptions)
    if (!attempt || Date.now() - attempt.startedAt > ATTEMPT_TTL_SECONDS * 1000) {
      throw new Error('OpenID Connect authorization session expired')
    }

    const callback = this.callbackUrl()
    callback.search = new URL(request.url(true), callback).search
    const configuration = await this.getConfiguration()
    const tokens = await oidc.authorizationCodeGrant(configuration, callback, {
      expectedState: attempt.state,
      expectedNonce: attempt.nonce,
      pkceCodeVerifier: attempt.codeVerifier,
      ...(reauthenticate ? { maxAge: 0 } : {}),
    })

    const claims = tokens.claims()
    if (!claims) throw new Error('OpenID Connect identity token missing')

    const userInfo = configuration.serverMetadata().userinfo_endpoint
      ? await oidc.fetchUserInfo(configuration, tokens.access_token, claims.sub)
      : claims

    const email = userInfo.email ?? claims.email
    const emailVerifiedClaim =
      userInfo.email === undefined
        ? claims.email_verified === true
        : userInfo.email_verified === true
    const displayName =
      userInfo.name ?? userInfo.preferred_username ?? claims.name ?? claims.preferred_username

    return {
      providerUserId: createHash('sha256')
        .update(JSON.stringify([claims.iss, claims.sub]))
        .digest('hex'),
      email:
        typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+$/.test(email)
          ? email
          : null,
      displayName: typeof displayName === 'string' ? displayName.trim().slice(0, 255) : null,
      phone: null,
      emailVerifiedClaim,
      returnTo: attempt.returnTo,
    } satisfies OidcProfile
  }
}
