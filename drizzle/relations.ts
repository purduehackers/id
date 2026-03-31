import { relations } from "drizzle-orm/relations";
import { user, passport, authGrant, authToken, authSession, oauthClient } from "./schema";

export const passportRelations = relations(passport, ({one}) => ({
	user: one(user, {
		fields: [passport.ownerId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	passports: many(passport),
	authGrants: many(authGrant),
	authSessions: many(authSession),
	oauthClients: many(oauthClient),
}));

export const authGrantRelations = relations(authGrant, ({one, many}) => ({
	user: one(user, {
		fields: [authGrant.ownerId],
		references: [user.id]
	}),
	authTokens: many(authToken),
}));

export const authTokenRelations = relations(authToken, ({one}) => ({
	authGrant: one(authGrant, {
		fields: [authToken.grantId],
		references: [authGrant.id]
	}),
}));

export const authSessionRelations = relations(authSession, ({one}) => ({
	user: one(user, {
		fields: [authSession.ownerId],
		references: [user.id]
	}),
}));

export const oauthClientRelations = relations(oauthClient, ({one}) => ({
	user: one(user, {
		fields: [oauthClient.ownerId],
		references: [user.id]
	}),
}));