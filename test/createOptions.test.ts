import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import * as outline from '../nodes/PresentationsAi/actions/outline';
import * as presentation from '../nodes/PresentationsAi/actions/presentation';
import { buildDeckRequest, toGraphicTypes } from '../nodes/PresentationsAi/helpers/deckBody';
import { toOutline } from '../nodes/PresentationsAi/helpers/outline';

const OUTLINE = { documentTitle: 'Plan', slides: [{ title: 'One' }, { title: 'Two' }] };

describe('new create options', () => {
	it('sends each option the API knows', () => {
		expect(
			buildDeckRequest({
				topic: 't',
				name: ' Board deck ',
				company: 'Example Inc',
				insiderContent: 'We grew in Q3',
				purpose: 'Sales',
				delivery: 'read',
				missingFigures: 'placeholder',
				qualityTier: 'premium',
				deepResearch: true,
				allowedGraphics: 'Table, list, table, ',
			}),
		).toMatchObject({
			name: 'Board deck',
			company: 'Example Inc',
			insider_content: 'We grew in Q3',
			deck_purpose: 'sales',
			delivery: 'read',
			missing_data: 'placeholder',
			budget_tier: 'premium',
			deep_search: true,
			graphic_types: ['table', 'list'],
		});
	});

	it('leaves Auto, Standard and unknown values to the API', () => {
		const body = buildDeckRequest({
			topic: 't',
			purpose: 'auto',
			delivery: 'hologram',
			missingFigures: 'auto',
			qualityTier: 'standard',
			deepResearch: false,
			allowedGraphics: ' ',
		});
		for (const key of [
			'deck_purpose',
			'delivery',
			'missing_data',
			'budget_tier',
			'deep_search',
			'graphic_types',
		]) {
			expect(body).not.toHaveProperty(key);
		}
	});

	it('builds from an outline instead of a prompt, without research', () => {
		const body = buildDeckRequest({
			topic: 'ignored',
			content: 'ignored',
			slideCount: 10,
			deepResearch: true,
			outline: OUTLINE,
		});
		expect(body.outline).toEqual(OUTLINE);
		for (const key of ['prompt', 'sources', 'slide_count', 'deep_search']) {
			expect(body).not.toHaveProperty(key);
		}
	});

	it('splits graphic types', () => {
		expect(toGraphicTypes('Diagram,  chart')).toEqual(['diagram', 'chart']);
		expect(toGraphicTypes(undefined)).toEqual([]);
	});
});

describe('toOutline', () => {
	it.each([
		['the outline itself', OUTLINE, OUTLINE],
		['Outline → Create output', { outline: OUTLINE }, OUTLINE],
		['JSON text', JSON.stringify({ outline: OUTLINE }), OUTLINE],
	])('accepts %s', (_label, input, expected) => {
		expect(toOutline(input)).toEqual(expected);
	});

	it("prefers Get Outline's final outline", () => {
		const final = { slides: [{ title: 'Final' }] };
		expect(toOutline({ outline: OUTLINE, final_outline: final })).toEqual(final);
		expect(toOutline({ outline: OUTLINE, final_outline: null })).toEqual(OUTLINE);
	});

	it.each([[''], ['not json'], [{ slides: 'x' }], [{ outline: null }], [42]])(
		'rejects %j',
		(input) => {
			expect(toOutline(input)).toBeUndefined();
		},
	);
});

type Route = (req: IHttpRequestOptions) => unknown;

function context(params: Record<string, unknown>, route: Route) {
	const requests: IHttpRequestOptions[] = [];
	const ctx = {
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		getNode: () => ({
			id: 'node-1',
			name: 'Presentations.AI',
			typeVersion: 2,
			type: 't',
			position: [0, 0],
			parameters: {},
		}),
		getCredentials: async () => ({ apiKey: 'pai_live_test', baseUrl: 'https://api.example.com' }),
		getInstanceId: () => 'instance-1',
		getWorkflow: () => ({ id: 'workflow-1' }),
		getExecutionId: () => 'execution-1',
		getWorkflowDataProxy: () => ({ $thisRunIndex: 0 }),
		getExecutionCancelSignal: () => undefined,
		getInputData: () => [{ json: {} }],
		helpers: {
			httpRequestWithAuthentication: vi.fn(async (_c: string, req: IHttpRequestOptions) => {
				requests.push(req);
				return route(req);
			}),
		},
	} as unknown as IExecuteFunctions;
	return { ctx, requests };
}

describe('Outline → Create', () => {
	it('sends the topic, content and settings with a stable Request-Id', async () => {
		const { ctx, requests } = context(
			{
				topic: ' Hiring plan ',
				content: 'Notes',
				slideCount: 7,
				language: 'auto',
				levelOfDetail: 'brief',
				options: {},
			},
			() => ({ outline: OUTLINE }),
		);
		const [item] = await outline.create.execute.call(ctx, 0);
		expect(requests[0].url).toBe('https://api.example.com/api/v1/outlines');
		expect(requests[0].body).toEqual({
			prompt: 'Hiring plan',
			sources: [{ type: 'text', content: 'Notes' }],
			slide_count: '7',
			level_of_detail: 'brief',
			language: 'auto',
		});
		const requestId = (requests[0].headers as Record<string, string>)['Request-Id'];
		expect(requestId).toMatch(/^[A-Za-z0-9]/);
		expect(item.json).toMatchObject({ request_id: requestId, outline: OUTLINE });
	});

	it('needs a topic, content or file', async () => {
		const { ctx, requests } = context({ topic: '', content: ' ', options: {} }, () => ({}));
		await expect(outline.create.execute.call(ctx, 0)).rejects.toThrow(
			'Nothing to build the outline from',
		);
		expect(requests).toHaveLength(0);
	});

	it('explains a 409 without claiming a second charge', async () => {
		const { ctx } = context({ topic: 'Plan', options: { requestId: 'my-id-1' } }, () => {
			throw Object.assign(new Error('Conflict'), {
				httpCode: '409',
				response: {
					status: 409,
					data: { error: { code: 'CONFLICT', message: 'Request-Id already paid for an outline' } },
				},
			});
		});
		await expect(outline.create.execute.call(ctx, 0)).rejects.toMatchObject({
			message: 'Request-Id already paid for an outline',
			description: expect.stringContaining("it wasn't charged again"),
		});
	});
});

describe('Create From Outline', () => {
	it('stops before calling the API when the outline has no slides', async () => {
		const { ctx, requests } = context({ outline: '{"title":"x"}' }, () => ({}));
		await expect(presentation.createFromOutline.execute.call(ctx, 0)).rejects.toThrow(
			"The 'Outline' parameter has no outline",
		);
		expect(requests).toHaveLength(0);
	});

	it('sends the outline and no prompt', async () => {
		const { ctx, requests } = context(
			{ outline: { outline: OUTLINE }, waitForCompletion: false, simplify: true, options: {} },
			(req) => {
				if (req.url.endsWith('/me')) return { project_id: null };
				return {
					request_id: 'r1',
					deck_id: 'd1',
					status: 'RUNNING',
					stage: 'SLIDES',
					status_url: 'https://api.example.com/api/v1/requests/r1',
					deck_url: 'https://app.example.com/d1',
					error: null,
					created_at: '',
					updated_at: '',
				};
			},
		);
		await presentation.createFromOutline.execute.call(ctx, 0);
		const body = requests.find((r) => r.url.endsWith('/decks'))?.body as Record<string, unknown>;
		expect(body.outline).toEqual(OUTLINE);
		expect(body).not.toHaveProperty('prompt');
	});
});
