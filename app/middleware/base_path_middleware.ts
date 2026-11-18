import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { appPath, basePath } from '#config/base_path'

export default class BasePathMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    if (!basePath) return next()

    const path = request.url()
    const rawUrl = request.request.url ?? ''

    // The container's internal health check uses the same URL for every deployment.
    if (path === '/api/v1/health' && ['GET', 'HEAD'].includes(request.method())) {
      return next()
    }

    if (path === basePath && rawUrl.split('?', 1)[0] === basePath) {
      return response.redirect(`${basePath}/${rawUrl.slice(basePath.length)}`, false, 308)
    }

    if (!path.startsWith(`${basePath}/`) || !rawUrl.startsWith(`${basePath}/`)) {
      return response.status(404).send('Not found')
    }

    // Adonis matches the parsed path. Its static middleware uses the native request URL.
    request.parsedUrl.pathname = path.slice(basePath.length)
    request.request.url = rawUrl.slice(basePath.length)

    // Redirects from controllers, auth, and validation share this response method.
    const location = response.location.bind(response)
    response.location = (url) => location(appPath(url))
    return next()
  }
}
