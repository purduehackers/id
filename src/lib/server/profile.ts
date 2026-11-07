import { env } from '$env/dynamic/private';
import { del, put } from '@vercel/blob';
import {
	ProfileError,
	validateProfile,
	type ProfileInput,
	type ValidatedProfile
} from '$lib/profile';
import { auth } from '$lib/server/auth';
import { renderAvatar } from '$lib/server/avatar-image';

export { ProfileError, validateProfile, type ProfileInput, type ValidatedProfile };

export async function updateProfile(
	userId: string,
	input: ProfileInput
): Promise<ValidatedProfile> {
	const validated = validateProfile(input);
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(userId, {
		givenName: validated.givenName,
		familyName: validated.familyName,
		phone: validated.phone,
		graduationYear: validated.graduationYear
	});
	return validated;
}

export class PictureStorageError extends Error {}

const BLOB_TIMEOUT = 10_000;

const blobOptions = () => ({
	token: env.BLOB_READ_WRITE_TOKEN || undefined,
	abortSignal: AbortSignal.timeout(BLOB_TIMEOUT)
});

async function deleteOldPicture(url: string | null | undefined) {
	if (!url) return;
	try {
		if (!new URL(url).hostname.endsWith('.blob.vercel-storage.com')) return;
		await del(url, blobOptions());
	} catch (error) {
		console.error('[profile] could not delete old picture', error);
	}
}

export async function setPicture(
	user: { id: string; image?: string | null },
	bytes: Uint8Array
): Promise<string> {
	const rendered = await renderAvatar(bytes);
	const { url } = await put(`avatars/${crypto.randomUUID()}.webp`, rendered, {
		...blobOptions(),
		access: 'public',
		contentType: 'image/webp',
		cacheControlMaxAge: 86400
	}).catch((cause) => {
		throw new PictureStorageError('Could not store picture', { cause });
	});
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(user.id, { image: url });
	await deleteOldPicture(user.image);
	return url;
}

export async function removePicture(user: { id: string; image?: string | null }): Promise<void> {
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(user.id, { image: null });
	await deleteOldPicture(user.image);
}
