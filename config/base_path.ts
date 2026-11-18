import env from '#start/env'
import { prefixAppPath, resolveBasePath } from '#helpers/base_path'

export const basePath = resolveBasePath(env.get('APP_BASE_PATH'), env.get('APP_URL'))

export function appPath(url: string): string {
  return prefixAppPath(basePath, url)
}
