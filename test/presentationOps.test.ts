import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import * as presentation from '../nodes/PresentationsAi/actions/presentation';
import { deckIdFrom, simplifyDeck } from '../nodes/PresentationsAi/helpers/utils';
import type { Deck, DeckDetail, ExternalDeckExportResponse } from '../nodes/PresentationsAi/types';

const DECK_ID = '01a1d3ca-a7af-7016-a8fe-c79fdbf5136c';

const deck = (id: string, name = 'Q3 plan'): Deck => ({
	id,
	workspace_id: 'w1',
	project_id: 'p1',
	created_by: 'u1',
	name,
	visibility: 'PRIVATE',
	deck_url: `https://app.example.com/decks/${id}`,
	has_share_link: false,
	archived_at: null,
	created_at: '2026-11-13T00:00:00Z',
	updated_at: '2026-11-13T01:00:00Z',
	flags: ['STARRED'],
});

const exportOf = (
	format: 'PPTX' | 'PDF',
	created: string,
	id: string,
): ExternalDeckExportResponse => ({
	id,
	deck_id: DECK_ID,
	format,
	content_type: format === 'PDF' ? 'application/pdf' : 'application/vnd.ms-powerpoint',
	size_bytes: 1234,
	download_url: `https://api.example.com/api/v1/decks/${DECK_ID}/exports/${id}/content`,
	created_at: created,
});

type Route = (req: IHttpRequestOptions) => unknown;

function context(params: Record<string, unknown>, route: Route) {
	const requests: IHttpRequestOptions[] = [];
	const ctx = {
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		getNode: () => ({
			id: 'n1',
			name: 'Presentations.AI',
			typeVersion: 2,
			type: 't',
			position: [0, 0],
			parameters: {},
		}),
		getCredentials: async () => ({ apiKey: 'pai_live_test', baseUrl: 'https://api.example.com' }),
		getExecutionCancelSignal: () => undefined,
		helpers: {
			httpRequestWithAuthentication: vi.fn(async (_c: string, req: IHttpRequestOptions) => {
				requests.push(req);
				return route(req);
			}),
			prepareBinaryData: vi.fn(async (data: Buffer, fileName: string, mimeType: string) => ({
				data: data.toString('base64'),
				fileName,
				mimeType,
			})),
		},
	} as unknown as IExecuteFunctions;
	return { ctx, requests };
}

describe('deckIdFrom', () => {
	it.each([
		[DECK_ID, DECK_ID],
		[{ mode: 'id', value: ` ${DECK_ID} ` }, DECK_ID],
		[`https://app.example.com/decks/${DECK_ID}`, DECK_ID],
		[
			`https://app.example.com/w/7c9e6679-7425-40de-944b-e07fc1f90ae7/decks/${DECK_ID}?tab=1`,
			DECK_ID,
		],
		['https://app.example.com/decks/', ''],
		['', ''],
	])('%j -> %s', (input, expected) => {
		expect(deckIdFrom(input)).toBe(expected);
	});
});

describe('simplifyDeck', () => {
	it('keeps ten fields of a presentation with status and formats', () => {
		const detail: DeckDetail = {
			...deck(DECK_ID),
			status: 'COMPLETED',
			exports: [exportOf('PPTX', '2026-11-13T00:00:00Z', 'e1')],
		};
		const simple = simplifyDeck(detail);
		expect(Object.keys(simple)).toHaveLength(10);
		expect(simple).toMatchObject({ status: 'COMPLETED', export_formats: ['PPTX'], id: DECK_ID });
	});

	it('marks starred list items', () => {
		expect(simplifyDeck(deck(DECK_ID)).starred).toBe(true);
	});
});

describe('Get', () => {
	it('reads the presentation by ID from a URL', async () => {
		const { ctx, requests } = context(
			{ presentation: `https://app.example.com/decks/${DECK_ID}`, simplify: true },
			() => ({ ...deck(DECK_ID), status: 'COMPLETED', exports: [] }),
		);
		const [item] = await presentation.get.execute.call(ctx, 0);
		expect(requests[0].url).toBe(`https://api.example.com/api/v1/decks/${DECK_ID}`);
		expect(item.json).toMatchObject({ id: DECK_ID, status: 'COMPLETED' });
	});

	it('stops with a clear message when no presentation is chosen', async () => {
		const { ctx } = context({ presentation: { mode: 'list', value: '' } }, () => ({}));
		await expect(presentation.get.execute.call(ctx, 0)).rejects.toThrow(
			"The 'Presentation' parameter is empty",
		);
	});
});

describe('Get Many', () => {
	const pages = (total: number) => (req: IHttpRequestOptions) => {
		const { page, limit } = req.qs as { page: number; limit: number };
		const start = (page - 1) * limit;
		const count = Math.max(0, Math.min(limit, total - start));
		return {
			data: Array.from({ length: count }, (_, i) => deck(`id-${start + i}`)),
			page,
			limit,
			total,
		};
	};

	it('maps filters and sort onto the query', async () => {
		const { ctx, requests } = context(
			{
				returnAll: false,
				limit: 5,
				filters: { projectId: { mode: 'id', value: 'p9' }, search: ' plan ', starredOnly: true },
				sort: { sortBy: 'NAME' },
				simplify: true,
			},
			pages(3),
		);
		const items = await presentation.getMany.execute.call(ctx, 0);
		expect(items).toHaveLength(3);
		expect(requests[0].qs).toEqual({
			sort: 'NAME',
			project_id: 'p9',
			search: 'plan',
			flag: 'STARRED',
			page: 1,
			limit: 5,
		});
	});

	it('pages with a fixed page size so no presentation repeats', async () => {
		const { ctx, requests } = context(
			{ returnAll: false, limit: 250, simplify: false },
			pages(500),
		);
		const items = await presentation.getMany.execute.call(ctx, 0);
		expect(items).toHaveLength(250);
		expect(requests.map((r) => r.qs)).toEqual([
			{ sort: 'RECENT', page: 1, limit: 200 },
			{ sort: 'RECENT', page: 2, limit: 200 },
		]);
		expect(new Set(items.map((i) => i.json.id)).size).toBe(250);
	});

	it('returns everything with Return All', async () => {
		const { ctx, requests } = context({ returnAll: true, simplify: true }, pages(410));
		expect(await presentation.getMany.execute.call(ctx, 0)).toHaveLength(410);
		expect(requests).toHaveLength(3);
	});
});

describe('Update', () => {
	it('sends only the fields that were set', async () => {
		const { ctx, requests } = context(
			{
				presentation: DECK_ID,
				updateFields: {
					name: ' Board update ',
					visibility: 'workspace',
					projectId: { mode: 'list', value: '' },
				},
				simplify: true,
			},
			() => deck(DECK_ID, 'Board update'),
		);
		await presentation.update.execute.call(ctx, 0);
		expect(requests[0].method).toBe('PATCH');
		expect(requests[0].body).toEqual({ name: 'Board update', visibility: 'WORKSPACE' });
	});

	it('stops before calling the API when nothing is set', async () => {
		const { ctx, requests } = context({ presentation: DECK_ID, updateFields: {} }, () => ({}));
		await expect(presentation.update.execute.call(ctx, 0)).rejects.toThrow('Nothing to update');
		expect(requests).toHaveLength(0);
	});
});

describe('Download', () => {
	const route = (exports: ExternalDeckExportResponse[]) => (req: IHttpRequestOptions) => {
		if (req.url.endsWith('/exports'))
			return { data: exports, page: 1, limit: 200, total: exports.length };
		return { body: Buffer.from('file'), headers: { 'content-type': 'application/pdf' } };
	};

	it('downloads the newest file of the chosen format', async () => {
		const { ctx, requests } = context(
			{ presentation: DECK_ID, format: 'pdf', options: { outputBinaryField: 'deck' } },
			route([
				exportOf('PDF', '2026-11-13T00:00:00Z', 'old'),
				exportOf('PPTX', '2026-11-13T05:00:00Z', 'pptx'),
				exportOf('PDF', '2026-11-13T03:00:00Z', 'new'),
			]),
		);
		const [item] = await presentation.download.execute.call(ctx, 0);
		expect(requests[1].url).toContain('/exports/new/content');
		expect(item.json).toMatchObject({ export_id: 'new', format: 'PDF' });
		expect(item.binary).toHaveProperty('deck');
	});

	it('names the formats it has when the chosen one is missing', async () => {
		const { ctx } = context(
			{ presentation: DECK_ID, format: 'pdf', options: {} },
			route([exportOf('PPTX', '2026-11-13T00:00:00Z', 'p')]),
		);
		await expect(presentation.download.execute.call(ctx, 0)).rejects.toMatchObject({
			message: 'This presentation has no PDF file',
			description: expect.stringContaining('Choose a format it has: PPTX'),
		});
	});
});

describe('Get Outline', () => {
	it('returns the outline JSON', async () => {
		const { ctx, requests } = context({ presentation: DECK_ID }, () => ({
			deck_id: DECK_ID,
			outline: { slides: [] },
		}));
		const [item] = await presentation.getOutline.execute.call(ctx, 0);
		expect(requests[0].url).toBe(`https://api.example.com/api/v1/decks/${DECK_ID}/outline`);
		expect(item.json).toMatchObject({ deck_id: DECK_ID });
	});
});
