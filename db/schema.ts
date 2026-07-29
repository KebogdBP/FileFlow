import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const siteTotals = sqliteTable('site_totals', {
  id: integer('id').primaryKey(),
  count: integer('count').notNull().default(0),
});

export const visitCounts = sqliteTable('visit_counts', {
  day: text('day').primaryKey(),
  count: integer('count').notNull().default(0),
});
