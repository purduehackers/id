import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { AVATAR_MAX_BYTES, ProfileError } from '../src/lib/profile.ts';
import { renderAvatar } from '../src/lib/server/avatar-image.ts';

const image = (width: number, height: number) =>
	sharp({ create: { width, height, channels: 3, background: '#c33' } });

test('renderAvatar makes a square WebP from JPEG, PNG and WebP', async () => {
	for (const format of ['jpeg', 'png', 'webp'] as const) {
		const input = await image(800, 300).toFormat(format).toBuffer();
		const meta = await sharp(await renderAvatar(input)).metadata();
		assert.equal(meta.format, 'webp');
		assert.equal(meta.width, 512);
		assert.equal(meta.height, 512);
	}
});

test('renderAvatar removes metadata and applies the orientation', async () => {
	const input = await image(800, 300)
		.withExif({ IFD0: { Copyright: 'secret' } })
		.withMetadata({ orientation: 6 })
		.jpeg()
		.toBuffer();
	assert.ok((await sharp(input).metadata()).exif);

	const meta = await sharp(await renderAvatar(input)).metadata();
	assert.equal(meta.exif, undefined);
	assert.equal(meta.orientation, undefined);
});

test('renderAvatar rejects SVG, other files and damaged images', async () => {
	const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9"/>');
	const damaged = (await image(100, 100).png().toBuffer()).subarray(0, 40);
	for (const input of [svg, Buffer.from('hello'), Buffer.alloc(0), damaged]) {
		await assert.rejects(renderAvatar(input), ProfileError);
	}
});

test('renderAvatar rejects files over the limit', async () => {
	await assert.rejects(renderAvatar(new Uint8Array(AVATAR_MAX_BYTES + 1)), /too large/);
});
