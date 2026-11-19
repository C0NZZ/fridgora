export type ExternalAuthProvider = 'microsoft' | 'discord' | 'oidc'

export const providerLabel = (provider: ExternalAuthProvider) =>
  ({ microsoft: 'Microsoft', discord: 'Discord', oidc: 'OpenID Connect' })[provider]

export const providerIcon = (provider: ExternalAuthProvider) =>
  ({ microsoft: 'pi pi-microsoft', discord: 'pi pi-discord', oidc: 'pi pi-key' })[provider]
