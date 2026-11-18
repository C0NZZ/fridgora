import env from '#start/env'
import { prefixAppPath, publicUrlAtBasePath, resolveBasePath } from '#helpers/base_path'

export const basePath = resolveBasePath(env.get('APP_BASE_PATH'), env.get('APP_URL'))

export function appPath(url: string): string {
  return prefixAppPath(basePath, url)
}

export function publicAppUrl(): string {
  const url = env.get('APP_URL')
  if (url) return publicUrlAtBasePath(url, basePath)

  const host = env.get('HOST')
  const authority = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host
  return `http://${authority}:${env.get('PORT')}${basePath}`
}
