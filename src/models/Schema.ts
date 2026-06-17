import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// This file defines the structure of your database tables using the Drizzle ORM.

// To modify the database schema:
// 1. Update this file with your desired changes.
// 2. Generate a new migration by running: `npm run db:generate`

// The generated migration file will reflect your schema changes.
// It automatically run the command `db-server:file`, which apply the migration before Next.js starts in development mode,
// Alternatively, if your database is running, you can run `npm run db:migrate` and there is no need to restart the server.

export const counterSchema = pgTable('counter', {
  id: serial('id').primaryKey(),
  count: integer('count').default(0),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const agentSchema = pgTable('agents', {
  id: serial('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  description: text('description').default('').notNull(),
  status: text('status').default('draft').notNull(),
  codexApiEndpoint: text('codex_api_endpoint').default('').notNull(),
  onlineSkillUrl: text('online_skill_url').default('').notNull(),
  mcpConnectorUrl: text('mcp_connector_url').default('').notNull(),
  trainedAt: timestamp('trained_at', { mode: 'date' }),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const agentSourceSchema = pgTable('agent_sources', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id')
    .references(() => agentSchema.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  url: text('url').default('').notNull(),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const agentSkillSchema = pgTable('agent_skills', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id')
    .references(() => agentSchema.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const agentMessageSchema = pgTable('agent_messages', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id')
    .references(() => agentSchema.id, { onDelete: 'cascade' })
    .notNull(),
  ownerId: text('owner_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});
