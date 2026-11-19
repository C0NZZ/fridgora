import '#tests/test_context'
import { test } from '@japa/runner'
import { hasMoneyPrecision, multiplyMoney, sumMoney } from '#shared/money'

test.group('Money', () => {
  test('adds and multiplies prices in minor units', ({ assert }) => {
    assert.strictEqual(sumMoney([0.1, 0.2]), 0.3)
    assert.strictEqual(sumMoney([25.29, -24.98]), 0.31)
    assert.strictEqual(multiplyMoney(0.29, 3), 0.87)
  })

  test('accepts whole prices and cents and rejects sub-cent precision', ({ assert }) => {
    assert.isTrue(hasMoneyPrecision(5))
    assert.isTrue(hasMoneyPrecision(0.29))
    assert.isFalse(hasMoneyPrecision(1.005))
    assert.isFalse(hasMoneyPrecision(Infinity))
  })
})
