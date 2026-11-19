import '#tests/test_context'
import { test } from '@japa/runner'
import { UserFactory } from '#database/factories/user_factory'
import User from '#models/user'
import UserAuthIdentity from '#models/user_auth_identity'
import env from '#start/env'
import { oidcClientId, oidcClientSecret, startOidcProvider } from '../../utils/oidc_provider.js'

test.group('Generic OpenID Connect', (group) => {
  let provider: Awaited<ReturnType<typeof startOidcProvider>>

  group.setup(async () => {
    provider = await startOidcProvider()
    const names = [
      'AUTH_PROVIDERS',
      'AUTH_AUTO_REGISTER_PROVIDERS',
      'AUTH_LOCAL_ADMIN_ONLY',
      'AUTH_REGISTRATION_MODE',
    ] as const
    const original = Object.fromEntries(names.map((name) => [name, process.env[name]]))
    process.env.AUTH_PROVIDERS = 'local,oidc'
    process.env.AUTH_AUTO_REGISTER_PROVIDERS = 'oidc'
    process.env.AUTH_LOCAL_ADMIN_ONLY = 'true'
    process.env.AUTH_REGISTRATION_MODE = 'open'
    const previousIssuer = env.get('AUTH_PROVIDER_OIDC_ISSUER')
    const previousClientId = env.get('AUTH_PROVIDER_OIDC_CLIENT_ID')
    const previousClientSecret = env.get('AUTH_PROVIDER_OIDC_CLIENT_SECRET')
    env.set('AUTH_PROVIDER_OIDC_ISSUER', provider.issuer)
    env.set('AUTH_PROVIDER_OIDC_CLIENT_ID', oidcClientId)
    env.set('AUTH_PROVIDER_OIDC_CLIENT_SECRET', oidcClientSecret)

    return async () => {
      for (const name of names) {
        if (original[name] === undefined) delete process.env[name]
        else process.env[name] = original[name]
      }
      env.set('AUTH_PROVIDER_OIDC_ISSUER', previousIssuer)
      env.set('AUTH_PROVIDER_OIDC_CLIENT_ID', previousClientId)
      env.set('AUTH_PROVIDER_OIDC_CLIENT_SECRET', previousClientSecret)
      await provider.close()
    }
  })

  test('local passwords are accepted for admins and declined for ordinary users', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('admin').create()
    const customer = await UserFactory.create()

    try {
      const submit = (user: User) =>
        client
          .post('/login')
          .form({ email: user.email, password: 'password123' })
          .withCsrfToken()
          .redirects(0)

      const customerLogin = await submit(customer)
      assert.equal(customerLogin.header('location'), '/login')
      const adminLogin = await submit(admin)
      assert.equal(adminLogin.header('location'), '/shop')

      const registration = await client.get('/register').redirects(0)
      assert.equal(registration.header('location'), '/login')
    } finally {
      await customer.delete()
      await admin.delete()
    }
  })

  test('a signed identity can register and sign in again with no email', async ({
    client,
    assert,
  }) => {
    const admin = await UserFactory.apply('admin').create()
    const name = 'OIDC Test Customer'

    try {
      for (const stateTampered of [true, false, false]) {
        const authorization = await client.get('/auth/oidc/redirect').redirects(0)
        authorization.assertStatus(302)
        const authorizeUrl = authorization.header('location')!
        assert.equal(new URL(authorizeUrl).origin, provider.issuer)
        const providerResponse = await fetch(authorizeUrl, { redirect: 'manual' })
        assert.equal(providerResponse.status, 302)
        const callback = new URL(providerResponse.headers.get('location')!)
        if (stateTampered) callback.searchParams.set('state', 'wrong-state')
        const attemptCookie = authorization.cookie('fridgora-oidc-attempt')
        assert.exists(attemptCookie?.value)
        const response = await client
          .get(callback.pathname + callback.search)
          .withEncryptedCookie('fridgora-oidc-attempt', attemptCookie?.value)
          .redirects(0)
        response.assertStatus(302)
        assert.equal(response.header('location'), stateTampered ? '/login' : '/shop')
        const users = await User.query().where('displayName', name)
        assert.lengthOf(users, stateTampered ? 0 : 1)
        if (!stateTampered) {
          const [user] = users
          assert.isNull(user.email)
          assert.isNull(user.password)
          assert.equal(user.role, 'customer')
          const identity = await UserAuthIdentity.query().where('userId', user.id).firstOrFail()
          assert.equal(identity.provider, 'oidc')
        }
      }
    } finally {
      await User.query().where('displayName', name).delete()
      await admin.delete()
    }
  })
})
