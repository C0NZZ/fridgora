import vine from '@vinejs/vine'
import { MONEY_DECIMAL_PLACES } from '#shared/money'

const expectedPrice = () => vine.number().decimal([0, MONEY_DECIMAL_PLACES]).min(0).optional()

/**
 * `expectedPrice` is the unit price the buyer was shown. When the lot sold next (FIFO)
 * costs anything else, nothing is bought — see OrderService.purchase().
 */
export const purchaseValidator = vine.compile(
  vine.object({
    deliveryId: vine.number().positive(),
    expectedPrice: expectedPrice(),
  })
)

export const apiOrderValidator = vine.compile(
  vine.object({
    deliveryId: vine.number().positive(),
    channel: vine.enum(['kiosk', 'scanner'] as const),
    expectedPrice: expectedPrice(),
  })
)

export const purchaseBasketValidator = vine.compile(
  vine.object({
    customerId: vine.number().positive(),
    items: vine
      .array(
        vine.object({
          deliveryId: vine.number().positive(),
          quantity: vine.number().withoutDecimals().positive().max(99),
          expectedPrice: expectedPrice(),
        })
      )
      .minLength(1),
  })
)

export const kioskPurchaseValidator = vine.compile(
  vine.object({
    customerId: vine.number().positive(),
    deliveryId: vine.number().positive(),
    expectedPrice: expectedPrice(),
  })
)
