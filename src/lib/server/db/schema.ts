import {
  sqliteTable,
  integer,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("user", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  discordId: text("discord_id").notNull().unique(),
  role: text("role", { enum: ["admin", "hacker"] }).notNull(),
  totp: text("totp"),
});

export const passports = sqliteTable("passport", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  version: integer("version").notNull(),
  surname: text("surname").notNull(),
  name: text("name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  dateOfIssue: text("date_of_issue").notNull(),
  placeOfOrigin: text("place_of_origin").notNull(),
  secret: text("secret").notNull(),
  activated: integer("activated", { mode: "boolean" }).notNull().default(false),
  ceremonyTime: integer("ceremony_time", { mode: "timestamp" }).notNull(),
});

export const ceremonies = sqliteTable("ceremonies", {
  ceremonyTime: integer("ceremony_time", { mode: "timestamp" }).primaryKey(),
  totalSlots: integer("total_slots").notNull(),
  openRegistration: integer("open_registration", { mode: "boolean" }).notNull(),
});

export const authGrants = sqliteTable("auth_grant", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  redirectUri: text("redirect_uri", { mode: "json" }).notNull(),
  until: integer("until", { mode: "timestamp" }).notNull(),
  scope: text("scope", { mode: "json" }).notNull(),
  clientId: text("client_id").notNull(),
  code: text("code"),
});

export const authTokens = sqliteTable("auth_token", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  grantId: integer("grant_id")
    .notNull()
    .references(() => authGrants.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  token: text("token").notNull(),
  until: integer("until", { mode: "timestamp" }).notNull(),
});

export const authSessions = sqliteTable("auth_session", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull(),
  until: integer("until", { mode: "timestamp" }).notNull(),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
});

export const oauthClients = sqliteTable("oauth_client", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
  redirectUris: text("redirect_uris", { mode: "json" }).notNull().$type<string[]>(),
  defaultScope: text("default_scope").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
