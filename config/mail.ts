import env from '#start/env'
import { defineConfig, MailResponse, transports } from '@adonisjs/mail'

export function isMailEnabled() {
  return env.get('MAIL_ENABLED', Boolean(env.get('SMTP_HOST')))
}

const smtpUsername = env.get('SMTP_USERNAME')
const smtpPassword = env.get('SMTP_PASSWORD')
const hasSmtpAuth = Boolean(smtpUsername && smtpPassword)

const mailConfig = defineConfig({
  default: isMailEnabled() ? 'smtp' : 'disabled',

  /**
   * A static address for the "from" property. It will be
   * used when not explicitly set on the Email
   */
  from: {
    address: env.get('SMTP_FROM_ADDRESS', 'noreply@lednice.it'),
    name: env.get('SMTP_FROM_NAME', env.get('APP_NAME', 'Fridgora')),
  },

  /**
   * The mailers object can be used to configure multiple mailers
   * each using a different transport driver.
   */
  mailers: {
    disabled: () => ({
      async send() {
        return new MailResponse('', { from: false, to: [] }, undefined)
      },
    }),
    smtp: transports.smtp({
      ...(hasSmtpAuth
        ? {
            auth: {
              type: 'login',
              user: smtpUsername!,
              pass: smtpPassword!,
            },
          }
        : {}),
      host: env.get('SMTP_HOST', 'localhost'),
      port: env.get('SMTP_PORT', 587),
      ...(env.get('SMTP_IGNORE_TLS')
        ? { ignoreTLS: true, tls: { rejectUnauthorized: false } }
        : {}),
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
