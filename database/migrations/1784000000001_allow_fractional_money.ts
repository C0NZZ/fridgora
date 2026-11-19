import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('deliveries', (table) => {
      table.decimal('price', 15, 2).notNullable().alter()
    })
    this.schema.alterTable('orders', (table) => {
      table.decimal('unit_price', 15, 2).notNullable().alter()
      table.decimal('original_unit_price', 15, 2).nullable().alter()
    })
    this.schema.alterTable('delivery_corrections', (table) => {
      table.decimal('old_price', 15, 2).notNullable().alter()
      table.decimal('new_price', 15, 2).notNullable().alter()
    })
    this.schema.alterTable('invoices', (table) => {
      table.decimal('total_cost', 15, 2).notNullable().alter()
    })
  }

  async down() {
    // An integer rollback must preserve the amounts already charged and invoiced.
    this.defer(async (db) => {
      await db.rawQuery(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM deliveries WHERE price <> trunc(price))
            OR EXISTS (SELECT 1 FROM orders
              WHERE unit_price <> trunc(unit_price) OR original_unit_price <> trunc(original_unit_price))
            OR EXISTS (SELECT 1 FROM delivery_corrections
              WHERE old_price <> trunc(old_price) OR new_price <> trunc(new_price))
            OR EXISTS (SELECT 1 FROM invoices WHERE total_cost <> trunc(total_cost))
          THEN
            RAISE EXCEPTION 'Cannot roll back price precision while fractional monetary amounts exist';
          END IF;
        END $$;
      `)
    })
    this.schema.alterTable('deliveries', (table) => {
      table.integer('price').notNullable().alter()
    })
    this.schema.alterTable('orders', (table) => {
      table.integer('unit_price').notNullable().alter()
      table.integer('original_unit_price').nullable().alter()
    })
    this.schema.alterTable('delivery_corrections', (table) => {
      table.integer('old_price').notNullable().alter()
      table.integer('new_price').notNullable().alter()
    })
    this.schema.alterTable('invoices', (table) => {
      table.integer('total_cost').notNullable().alter()
    })
  }
}
