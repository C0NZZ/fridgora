import type { HttpContext } from '@adonisjs/core/http'
import { listRedirectUrl } from '#helpers/list_redirect'
import logger from '@adonisjs/core/services/logger'
import { createInviteValidator } from '#validators/auth'
import AuditService from '#services/audit_service'
import InvitationService from '#services/invitation_service'
import NotificationService from '#services/notification_service'
import { isDomainError } from '#services/domain_error'

export default class InvitationsController {
  private invitations = new InvitationService()

  async store({ request, response, session, i18n, auth }: HttpContext) {
    const data = await request.validateUsing(createInviteValidator)

    try {
      const { invitation, inviteUrl } = await this.invitations.createInvite({
        email: data.email,
        role: data.role ?? 'customer',
        invitedByUserId: auth.user!.id,
      })

      const notificationService = new NotificationService()
      notificationService
        .sendRegistrationInvite({
          email: invitation.email,
          inviteUrl,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        })
        .catch((err) => {
          logger.error({ err, email: invitation.email }, 'Failed to send registration invite email')
        })

      await AuditService.log(
        auth.user!.id,
        'invitation.created',
        'user_invitation',
        invitation.id,
        null,
        {
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt.toISO(),
        }
      )

      session.flash('alert', {
        type: 'success',
        message: i18n.t('messages.invite_created', { email: invitation.email }),
      })
      return response.redirect(listRedirectUrl(request, '/admin/users'))
    } catch (error) {
      if (isDomainError(error, 'EMAIL_ALREADY_REGISTERED')) {
        session.flash('alert', {
          type: 'danger',
          message: i18n.t('messages.invite_email_already_registered'),
        })
        return response.redirect(listRedirectUrl(request, '/admin/users'))
      }
      throw error
    }
  }

  async revoke({ params, request, response, session, i18n, auth }: HttpContext) {
    const invite = await this.invitations.revokeInvite(Number(params.id))

    await AuditService.log(
      auth.user!.id,
      'invitation.revoked',
      'user_invitation',
      invite.id,
      null,
      {
        email: invite.email,
      }
    )

    session.flash('alert', {
      type: 'success',
      message: i18n.t('messages.invite_revoked', { email: invite.email }),
    })
    return response.redirect(listRedirectUrl(request, '/admin/users'))
  }
}
