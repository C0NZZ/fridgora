import env from '#start/env'

export const externalAuthProviders = ['microsoft', 'discord', 'oidc'] as const
export type ExternalAuthProvider = (typeof externalAuthProviders)[number]

export function isExternalAuthProvider(value: unknown): value is ExternalAuthProvider {
  return externalAuthProviders.some((provider) => provider === value)
}
export type AuthProvider = 'local' | ExternalAuthProvider
export type ProviderEmailVerificationMode = 'always' | 'claim' | 'never'

function parseCommaList(raw: string | undefined, fallback: string[] = []): Set<string> {
  if (raw === undefined) return new Set(fallback)

  return new Set(
    raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
  )
}

export default class AuthModeService {
  getEnabledProviders(): Set<AuthProvider> {
    const configured = parseCommaList(process.env.AUTH_PROVIDERS ?? env.get('AUTH_PROVIDERS'), [
      'local',
    ])
    const providers = new Set<AuthProvider>()

    if (configured.has('local') || this.isLocalAdminOnly()) {
      providers.add('local')
    }

    for (const provider of externalAuthProviders) {
      if (configured.has(provider)) {
        providers.add(provider)
      }
    }

    if (providers.size === 0) {
      providers.add('local')
    }

    return providers
  }

  getEnabledExternalProviders(): ExternalAuthProvider[] {
    const enabled = this.getEnabledProviders()
    return externalAuthProviders.filter((provider) => enabled.has(provider))
  }

  getDefaultExternalProvider(): ExternalAuthProvider | null {
    return this.getEnabledExternalProviders()[0] ?? null
  }

  isProviderEnabled(provider: ExternalAuthProvider): boolean {
    return this.getEnabledProviders().has(provider)
  }

  isLocalEnabled(): boolean {
    return this.getEnabledProviders().has('local')
  }

  isOidcEnabled(): boolean {
    return this.getEnabledExternalProviders().length > 0
  }

  isLocalAdminOnly(): boolean {
    const configured = process.env.AUTH_LOCAL_ADMIN_ONLY
    return configured === undefined
      ? env.get('AUTH_LOCAL_ADMIN_ONLY', false)
      : configured === 'true'
  }

  allowsLocalCredentials(user: { role: string; isKiosk?: boolean }): boolean {
    return !this.isLocalAdminOnly() || user.role === 'admin' || user.isKiosk === true
  }

  isLocalLoginDisabled(): boolean {
    return !this.isLocalEnabled()
  }

  isProviderAutoRegisterEnabled(provider: ExternalAuthProvider): boolean {
    const processProviders = parseCommaList(process.env.AUTH_AUTO_REGISTER_PROVIDERS)
    if (processProviders.size > 0) {
      return processProviders.has(provider)
    }

    const configuredProviders = parseCommaList(env.get('AUTH_AUTO_REGISTER_PROVIDERS'))
    if (configuredProviders.size > 0) {
      return configuredProviders.has(provider)
    }
    return false
  }

  isOidcAutoRegisterEnabled(): boolean {
    return this.isProviderAutoRegisterEnabled('microsoft')
  }

  isOidcOnlyMode(): boolean {
    return this.getEnabledExternalProviders().length > 0 && !this.isLocalEnabled()
  }

  getProviderEmailVerificationMode(provider: ExternalAuthProvider): ProviderEmailVerificationMode {
    if (provider === 'oidc') return 'claim'

    const envValue =
      provider === 'microsoft'
        ? env.get('AUTH_PROVIDER_MICROSOFT_EMAIL_VERIFICATION_MODE')
        : env.get('AUTH_PROVIDER_DISCORD_EMAIL_VERIFICATION_MODE')

    if (envValue === 'always' || envValue === 'claim' || envValue === 'never') {
      return envValue
    }

    return provider === 'discord' ? 'claim' : 'always'
  }

  isProviderEmailTrusted(
    provider: ExternalAuthProvider,
    claimValue: boolean | null | undefined
  ): boolean {
    const mode = this.getProviderEmailVerificationMode(provider)
    if (mode === 'always') return true
    if (mode === 'never') return false
    return claimValue === true
  }
}
