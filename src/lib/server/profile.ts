import {
	ProfileError,
	validateProfile,
	type ProfileInput,
	type ValidatedProfile
} from '$lib/profile';
import { auth } from '$lib/server/auth';
import { renderAvatar } from '$lib/server/avatar-image';
import { deleteByUrl, putObject } from '$lib/server/r2';

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

async function deleteOldPicture(url: string | null | undefined) {
	if (!url) return;
	try {
		await deleteByUrl(url);
	} catch (error) {
		console.error('[profile] could not delete old picture', error);
	}
}

export async function setPicture(
	user: { id: string; image?: string | null },
	bytes: Uint8Array
): Promise<string> {
	const rendered = await renderAvatar(bytes);
	const image = await putObject(`avatars/${crypto.randomUUID()}.webp`, rendered, {
		'content-type': 'image/webp',
		'cache-control': 'public, max-age=86400'
	});
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(user.id, { image });
	await deleteOldPicture(user.image);
	return image;
}

export async function removePicture(user: { id: string; image?: string | null }): Promise<void> {
	const ctx = await auth.$context;
	await ctx.internalAdapter.updateUser(user.id, { image: null });
	await deleteOldPicture(user.image);
}
