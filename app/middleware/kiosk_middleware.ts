import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { appPath } from '#config/base_path'

/**
 * Kiosk middleware redirects kiosk users to the kiosk interface.
 * Applied on non-kiosk pages to prevent kiosk accounts from accessing the full UI.
 */
export default class KioskMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const user = ctx.auth.user

    if (user?.isKiosk) {
      return ctx.response.redirect(appPath('/kiosk'))
    }

    return next()
  }
}
