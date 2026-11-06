import { describe, expect, it } from 'vitest';

import {
	buildExportFileName,
	extractRequestId,
	getApiErrorBody,
	getHttpStatus,
	getRetryAfterMs,
	locatorValue,
	parseRetryAfterMs,
	sanitizeFileName,
	simplifyDeckResponse,
	toText,
} from '../nodes/PresentationsAi/helpers/utils';

describe('extractRequestId', () => {
	it.each([
		['n8n-1-abc-0-ff', 'n8n-1-abc-0-ff'],
		['  my-id  ', 'my-id'],
		['https://api.presentations.ai/api/v1/requests/my-id', 'my-id'],
		['https://api.presentations.ai/api/v1/requests/my-id/?x=1#y', 'my-id'],
		['https://api.presentations.ai/api/v1/requests/a%3Ab', 'a:b'],
		// pollUrl saved by earlier versions of the node
		['https://api.presentations.ai/api/v1/polljob/03267dc1-1338', '03267dc1-1338'],
		['', undefined],
		['https://', undefined],
	])('%s -> %s', (input, expected) => {
		expect(extractRequestId(input)).toBe(expected);
	});
});

describe('buildExportFileName', () => {
	it('prefers the filename the server sends', () => {
		expect(
			buildExportFileName({
				format: 'PPTX',
				deckId: 'd1',
				contentDisposition: 'attachment; filename="Board update.pptx"',
				title: 'Other',
			}),
		).toBe('Board update.pptx');
	});
	it('decodes RFC 5987 filenames', () => {
		expect(
			buildExportFileName({
				format: 'PDF',
				deckId: 'd1',
				contentDisposition: "attachment; filename*=UTF-8''Plan%20d%C3%A9taill%C3%A9.pdf",
			}),
		).toBe('Plan détaillé.pdf');
	});
	it('falls back to the deck title with the right extension', () => {
		expect(buildExportFileName({ format: 'IMAGE', deckId: 'd1', title: 'Q3: plan/review' })).toBe(
			'Q3- plan-review.zip',
		);
	});
	it('falls back to the deck ID', () => {
		expect(buildExportFileName({ format: 'PDF', deckId: 'd1' })).toBe('presentation-d1.pdf');
	});
	it('does not double the extension', () => {
		expect(buildExportFileName({ format: 'PDF', deckId: 'd1', title: 'deck.pdf' })).toBe(
			'deck.pdf',
		);
	});
});

describe('sanitizeFileName', () => {
	it('removes control characters, separators and leading dots', () => {
		expect(sanitizeFileName('..\u0001bad/na\\me\n')).toBe('bad-na-me');
	});
	it('keeps the extension when shortening long names', () => {
		const name = sanitizeFileName(`${'Quarterly business review '.repeat(6)}.pptx`);
		expect(name.length).toBeLessThanOrEqual(120);
		expect(name.endsWith('.pptx')).toBe(true);
	});
});

describe('getApiErrorBody', () => {
	const body = { error: { code: 'REQUEST_ID_CONFLICT', message: 'Changed body' } };
	it('reads the envelope n8n stores on NodeApiError', () => {
		expect(getApiErrorBody({ context: { data: body } })?.code).toBe('REQUEST_ID_CONFLICT');
	});
	it('reads the envelope from the original HTTP error', () => {
		expect(getApiErrorBody({ cause: { response: { data: body } } })?.message).toBe('Changed body');
	});
	it('decodes error bodies of binary downloads', () => {
		const bytes = Buffer.from(JSON.stringify(body));
		expect(getApiErrorBody({ response: { data: bytes } })?.code).toBe('REQUEST_ID_CONFLICT');
		expect(getApiErrorBody({ response: { data: Buffer.from('not json') } })).toBeUndefined();
	});
	it('finds the envelope on a wrapped error', () => {
		expect(getApiErrorBody({ cause: { context: { data: body } } })?.code).toBe(
			'REQUEST_ID_CONFLICT',
		);
	});
	it('ignores anything else', () => {
		expect(getApiErrorBody(new Error('x'))).toBeUndefined();
		expect(getApiErrorBody({ context: { data: { error: 'plain string' } } })).toBeUndefined();
		expect(getApiErrorBody(null)).toBeUndefined();
	});
});

describe('getHttpStatus', () => {
	it('reads the status from n8n errors and HTTP client errors', () => {
		expect(getHttpStatus({ httpCode: '404' })).toBe('404');
		expect(getHttpStatus({ response: { status: 409 } })).toBe('409');
		expect(getHttpStatus({ cause: { response: { status: 503 } } })).toBe('503');
		expect(getHttpStatus({ httpCode: null, cause: { httpCode: '422' } })).toBe('422');
	});
	it('returns undefined when there is no status', () => {
		expect(getHttpStatus({ httpCode: null })).toBeUndefined();
		expect(getHttpStatus(new Error('x'))).toBeUndefined();
		expect(getHttpStatus(undefined)).toBeUndefined();
	});
});

describe('simplifyDeckResponse', () => {
	const response = {
		request_id: 'r1',
		deck_id: 'd1',
		status: 'COMPLETED' as const,
		stage: 'COMPLETED' as const,
		status_url: 'https://api.presentations.ai/api/v1/requests/r1',
		deck_url: 'https://example.com/decks/d1',
		error: null,
		created_at: '2026-11-06T00:00:00Z',
		updated_at: '2026-11-06T00:01:00Z',
		warnings: [],
		export: {
			id: 'e1',
			deck_id: 'd1',
			format: 'PDF' as const,
			content_type: 'application/pdf',
			size_bytes: 2048,
			download_url: 'https://api.presentations.ai/api/v1/decks/d1/exports/e1/content',
			created_at: '2026-11-06T00:01:00Z',
		},
	};
	it('returns at most ten flat fields', () => {
		const simple = simplifyDeckResponse(response, { url: 'https://example.com/share/d1' });
		expect(Object.keys(simple)).toHaveLength(10);
		expect(simple).toMatchObject({
			status: 'COMPLETED',
			export_format: 'PDF',
			file_size_bytes: 2048,
			share_url: 'https://example.com/share/d1',
		});
		for (const value of Object.values(simple))
			expect(typeof value === 'object' && value !== null).toBe(false);
	});
	it('uses null for what is not there yet', () => {
		const simple = simplifyDeckResponse({ ...response, status: 'RUNNING', export: null });
		expect(simple).toMatchObject({ export_format: null, file_size_bytes: null, share_url: null });
	});
});

describe('toText', () => {
	it.each([
		[42, '42'],
		[null, ''],
		[undefined, ''],
		['abc', 'abc'],
		[false, 'false'],
	])('%s -> %s', (input, expected) => {
		expect(toText(input)).toBe(expected);
	});
});

describe('parseRetryAfterMs', () => {
	const now = Date.parse('2026-11-06T10:00:00Z');
	it('reads seconds and HTTP dates', () => {
		expect(parseRetryAfterMs('7', now)).toBe(7000);
		expect(parseRetryAfterMs(['3'], now)).toBe(3000);
		expect(parseRetryAfterMs('Fri, 06 Nov 2026 10:00:30 GMT', now)).toBe(30000);
	});
	it('ignores missing or unreadable values', () => {
		expect(parseRetryAfterMs(undefined, now)).toBeUndefined();
		expect(parseRetryAfterMs('soon', now)).toBeUndefined();
	});
});

describe('getRetryAfterMs', () => {
	it('reads the value stored on a node error or the HTTP response header', () => {
		expect(getRetryAfterMs({ context: { retryAfterMs: 2000 } })).toBe(2000);
		expect(getRetryAfterMs({ cause: { response: { headers: { 'retry-after': '4' } } } })).toBe(
			4000,
		);
		expect(getRetryAfterMs(new Error('x'))).toBeUndefined();
	});
});

describe('locatorValue', () => {
	it('reads resource locator values and plain strings', () => {
		expect(locatorValue({ __rl: true, mode: 'list', value: ' kit-1 ' })).toBe('kit-1');
		expect(locatorValue({ __rl: true, mode: 'id', value: '' })).toBe('');
		expect(locatorValue('kit-2')).toBe('kit-2');
		expect(locatorValue(undefined)).toBe('');
		expect(locatorValue({ mode: 'list' })).toBe('');
	});
});
