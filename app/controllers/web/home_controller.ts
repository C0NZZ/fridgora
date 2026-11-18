import type { HttpContext } from '@adonisjs/core/http'
import { appPath } from '#config/base_path'

export default class HomeController {
  async index({ auth, response, inertia }: HttpContext) {
    // If user is logged in, redirect to shop
    if (auth.isAuthenticated) {
      return response.redirect(appPath('/shop'))
    }
    return inertia.render('home', {})
  }
}
