import sharp from 'sharp';
import { AVATAR_MAX_BYTES, ProfileError } from '../profile.ts';

const AVATAR_SIZE = 512;
const MAX_INPUT_PIXELS = 40_000_000;

function isAllowedImage(bytes: Uint8Array) {
	const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
	const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	const png = bytes[0] === 0x89 && ascii(1, 8) === 'PNG\r\n\x1a\n';
	const webp = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
	return jpeg || png || webp;
}

export async function renderAvatar(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
	if (bytes.length > AVATAR_MAX_BYTES) {
		throw new ProfileError('That picture is too large. Use one under 4 MB.');
	}
	if (!isAllowedImage(bytes)) {
		throw new ProfileError('Use a JPEG, PNG or WebP picture.');
	}
	try {
		const output = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
			.rotate()
			.resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
			.webp({ quality: 82 })
			.toBuffer();
		return new Uint8Array(output);
	} catch {
		throw new ProfileError('We could not read that picture. Try a different one.');
	}
}
