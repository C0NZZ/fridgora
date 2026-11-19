export const MONEY_DECIMAL_PLACES = 2
const MINOR_UNITS = 10 ** MONEY_DECIMAL_PLACES
export const MIN_UNIT_PRICE = 1 / MINOR_UNITS

export function toMinorUnits(amount: number): number {
  return Math.round(amount * MINOR_UNITS)
}

export function fromMinorUnits(amount: number): number {
  return amount / MINOR_UNITS
}

export function hasMoneyPrecision(amount: number): boolean {
  const units = toMinorUnits(amount)
  return Number.isSafeInteger(units) && fromMinorUnits(units) === amount
}

export function multiplyMoney(amount: number, quantity: number): number {
  return fromMinorUnits(toMinorUnits(amount) * quantity)
}

export function sumMoney(amounts: Iterable<number>): number {
  let total = 0
  for (const amount of amounts) total += toMinorUnits(amount)
  return fromMinorUnits(total)
}
