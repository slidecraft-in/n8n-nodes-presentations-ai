import { describe, expect, it } from 'vitest';

import { normalizeBaseUrl } from '../nodes/PresentationsAi/transport';

describe('normalizeBaseUrl', () => {
	it.each([
		[undefined, 'https://api.presentations.ai'],
		['', 'https://api.presentations.ai'],
		['  https://api.dev.presentations.ai/ ', 'https://api.dev.presentations.ai'],
		['https://api.presentations.ai/api/v1', 'https://api.presentations.ai'],
		['https://api.presentations.ai/api/v1/', 'https://api.presentations.ai'],
	])('%s -> %s', (input, expected) => {
		expect(normalizeBaseUrl(input)).toBe(expected);
	});
});
