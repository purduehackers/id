import { sqliteTable, AnySQLiteColumn, integer, text, foreignKey } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const user = sqliteTable("user", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	discordId: text("discord_id").notNull(),
	role: text().notNull(),
	totp: text(),
	savesSession: integer("saves_session").default(0).notNull(),
});

export const passport = sqliteTable("passport", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	ownerId: integer("owner_id").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	version: integer().notNull(),
	surname: text().notNull(),
	name: text().notNull(),
	dateOfBirth: text("date_of_birth").notNull(),
	dateOfIssue: text("date_of_issue").notNull(),
	placeOfOrigin: text("place_of_origin").notNull(),
	secret: text().notNull(),
	activated: integer().default(0).notNull(),
	ceremonyTime: integer("ceremony_time").notNull(),
});

export const ceremonies = sqliteTable("ceremonies", {
	ceremonyTime: integer("ceremony_time").primaryKey().notNull(),
	totalSlots: integer("total_slots").notNull(),
	openRegistration: integer("open_registration").notNull(),
});

export const authGrant = sqliteTable("auth_grant", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	ownerId: integer("owner_id").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	redirectUri: text("redirect_uri").notNull(),
	until: integer().notNull(),
	scope: text().notNull(),
	clientId: text("client_id").notNull(),
	code: text(),
});

export const authToken = sqliteTable("auth_token", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	grantId: integer("grant_id").notNull().references(() => authGrant.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	token: text().notNull(),
	until: integer().notNull(),
});

export const authSession = sqliteTable("auth_session", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	token: text().notNull(),
	until: integer().notNull(),
	ownerId: integer("owner_id").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
});

export const oauthClient = sqliteTable("oauth_client", {
	id: integer().primaryKey({ autoIncrement: true }).notNull(),
	clientId: text("client_id").notNull(),
	clientSecret: text("client_secret"),
	ownerId: integer("owner_id").notNull().references(() => user.id, { onDelete: "cascade", onUpdate: "cascade" } ),
	redirectUris: text("redirect_uris").notNull(),
	defaultScope: text("default_scope").notNull(),
	name: text().notNull(),
	createdAt: integer("created_at").notNull(),
});

