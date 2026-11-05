import {
	ProfileError,
	validateProfile,
	type ProfileInput,
	type ValidatedProfile
} from '$lib/profile';
import { auth } from '$lib/server/auth';

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
