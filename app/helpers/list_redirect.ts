import type { HttpContext } from '@adonisjs/core/http'
import { appPath } from '#config/base_path'

/**
 * Where to send the browser back to after a mutation performed from a filtered list.
 *
 * Redirecting to the bare list path drops the query string, so the page reloads
 * unfiltered on page 1 while the filter bar still shows the previous filters — the URL
 * and the table end up describing different things. Copy the query for recognized list
 * paths and return an app-relative destination for the redirect middleware.
 */
export function listRedirectUrl(
  request: HttpContext['request'],
  listPath: string,
  ...otherListPaths: string[]
): string {
  const referer = request.header('referer') ?? ''

  try {
    const { pathname, search } = new URL(referer, `${request.protocol()}://${request.host()}`)
    const path = [listPath, ...otherListPaths].find((candidate) => appPath(candidate) === pathname)
    if (path) return path + search
  } catch {
    // Unparseable referer — fall through to the plain list path.
  }

  return listPath
}
