import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const storefrontSettings = sqliteTable('storefront_settings', {
  id: integer('id').primaryKey(),
  primaryColor: text('primary_color').notNull().default('#0ea5e9'),
  bgColor: text('bg_color').notNull().default('#0f172a'),
  textColor: text('text_color').notNull().default('#ffffff'),
});
