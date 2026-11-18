export function resolveBasePath(override?: string, appUrl?: string): string {
  const configuredPath = override?.trim() || (appUrl ? new URL(appUrl).pathname : '/')
  const path = configuredPath.replace(/\/+$/, '')

  if (
    !configuredPath.startsWith('/') ||
    configuredPath.startsWith('//') ||
    (path && !/^(\/[A-Za-z0-9._~-]+)+$/.test(path)) ||
    path.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('APP_BASE_PATH must be a URL path such as /fridgora')
  }

  return path
}

export function prefixAppPath(basePath: string, url: string): string {
  return url.startsWith('/') && !url.startsWith('//') ? basePath + url : url
}
