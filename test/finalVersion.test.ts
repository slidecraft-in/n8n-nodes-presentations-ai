// Tests read the example templates from disk; they are not part of the published package.
/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals */
import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

import { createDeckForItem } from '../nodes/PresentationsAi/actions/deck';
import * as presentation from '../nodes/PresentationsAi/actions/presentation';
import { PresentationsAi } from '../nodes/PresentationsAi/PresentationsAi.node';
import { canonicalJson, deriveRequestId } from '../nodes/PresentationsAi/helpers/requestId';
import { deckIdFrom } from '../nodes/PresentationsAi/helpers/utils';
import { apiRequest } from '../nodes/PresentationsAi/transport';

type Params = Record<string, unknown>;
type Route = (req: IHttpRequestOptions) => unknown;

const DECK = '01a1d3ca-a7af-7016-a8fe-c79fdbf5136c';

const running = (requestId: string, status = 'RUNNING', deckId = 'deck-1') => ({
	request_id: requestId,
	deck_id: deckId,
	status,
	stage: status === 'FAILED' ? 'FAILED' : 'OUTLINE',
	status_url: `https://api.example.com/api/v1/requests/${requestId}`,
	deck_url: `https://app.example.com/decks/${deckId}`,
	error: status === 'FAILED' ? 'boom' : null,
	created_at: '2026-11-15T00:00:00Z',
	updated_at: '2026-11-15T00:00:00Z',
});

function httpError(status: number, error?: Record<string, unknown>, headers: Params = {}) {
	return Object.assign(new Error(`Request failed with status code ${status}`), {
		httpCode: String(status),
		response: { status, headers, data: error ? { error } : undefined },
	});
}

const notFound = () => httpError(404, { code: 'NOT_FOUND', message: 'Not found' });

function context(
	typeVersion: number,
	params: Params,
	route: Route,
	apiKey = 'pai_live_test',
	me: Params = { project_id: null },
	executionId = 'execution-1',
) {
	const requests: IHttpRequestOptions[] = [];
	const values: Params = { waitForCompletion: false, simplify: true, options: {}, ...params };
	const ctx = {
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in values ? values[name] : fallback,
		getNode: () => ({
			id: 'node-1',
			name: 'Presentations.AI',
			typeVersion,
			type: 't',
			position: [0, 0],
			parameters: {},
		}),
		getCredentials: async () => ({ apiKey, baseUrl: 'https://api.example.com' }),
		getInstanceId: () => 'instance-1',
		getWorkflow: () => ({ id: 'workflow-1' }),
		getExecutionId: () => executionId,
		getWorkflowDataProxy: () => ({ $thisRunIndex: 0 }),
		getExecutionCancelSignal: () => undefined,
		getInputData: () => [
			{
				json: {},
				binary: { data: { fileName: 'report.md', mimeType: 'text/markdown', data: '' } },
			},
		],
		helpers: {
			assertBinaryData: () => ({ fileName: 'report.md', mimeType: 'text/markdown', data: '' }),
			getBinaryDataBuffer: async () => Buffer.from(String(values.fileText ?? 'report text')),
			httpRequestWithAuthentication: vi.fn(async (_c: string, req: IHttpRequestOptions) => {
				requests.push(req);
				if (req.url.endsWith('/me')) return me;
				return route(req);
			}),
		},
	} as unknown as IExecuteFunctions;
	const posts = () => requests.filter((r) => r.method === 'POST' && r.url.endsWith('/decks'));
	return { ctx, requests, posts };
}

const requestIdOf = (req: IHttpRequestOptions) =>
	(req.headers as Record<string, string>)['Request-Id'];

describe('version 3 Request ID from the key and inputs', () => {
	it('is the same for the same inputs and differs when an input or the key changes', () => {
		const body = { prompt: 'Q3 plan', language: 'auto' };
		const id = deriveRequestId('k1', body);
		expect(id).toMatch(/^n8n3-[0-9a-f]{40}$/);
		expect(deriveRequestId('k1', { language: 'auto', prompt: 'Q3 plan' })).toBe(id);
		expect(deriveRequestId('k1', { ...body, prompt: 'Q4 plan' })).not.toBe(id);
		expect(deriveRequestId('k2', body)).not.toBe(id);
		expect(deriveRequestId('k1', body, 2)).toBe(`${id}-2`);
	});

	it('sorts keys at every level', () => {
		expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: 'z' } })).toBe(
			'{"a":{"c":"z","d":[2,{"x":2,"y":1}]},"b":1}',
		);
	});

	it('creates with the derived ID when nothing used it yet', async () => {
		const { ctx, posts } = context(3, {}, (req) => {
			if (req.url.includes('/requests/')) throw notFound();
			if (req.method === 'POST') return running(requestIdOf(req));
			throw new Error(`unexpected ${req.method} ${req.url}`);
		});
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(posts()).toHaveLength(1);
		expect(requestIdOf(posts()[0])).toMatch(/^n8n3-[0-9a-f]{40}$/);
	});

	it('returns the presentation already made for the same inputs without creating again', async () => {
		const { ctx, posts } = context(3, {}, (req) => {
			if (req.url.includes('/requests/')) return running(req.url.split('/').pop()!, 'COMPLETED');
			if (req.url.endsWith('/decks/deck-1')) return { id: 'deck-1' };
			throw new Error(`unexpected ${req.method} ${req.url}`);
		});
		const item = await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(posts()).toHaveLength(0);
		expect(item.json.status).toBe('COMPLETED');
	});

	it('moves to the next attempt after a FAILED or deleted presentation', async () => {
		const seen: string[] = [];
		const { ctx, posts } = context(3, {}, (req) => {
			if (req.url.includes('/requests/')) {
				const id = decodeURIComponent(req.url.split('/').pop()!);
				seen.push(id);
				if (!id.match(/-\d+$/)) return running(id, 'FAILED');
				if (id.endsWith('-2')) return running(id, 'COMPLETED', 'deck-gone');
				throw notFound();
			}
			if (req.url.endsWith('/decks/deck-gone')) throw notFound();
			if (req.method === 'POST') return running(requestIdOf(req));
			throw new Error(`unexpected ${req.method} ${req.url}`);
		});
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(seen.map((id) => id.replace(/^n8n3-[0-9a-f]{40}/, 'base'))).toEqual([
			'base',
			'base-2',
			'base-3',
		]);
		expect(requestIdOf(posts()[0])).toMatch(/-3$/);
	});

	it('keeps the per-run ID in version 2', async () => {
		const { ctx, posts } = context(2, {}, (req) => {
			if (req.method === 'POST') return running(requestIdOf(req));
			throw new Error(`unexpected ${req.method} ${req.url}`);
		});
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(requestIdOf(posts()[0])).toMatch(/^n8n-[0-9a-f]{40}$/);
	});

	it('uses your own Request ID as is', async () => {
		const { ctx, posts } = context(3, { options: { requestId: 'my-id-1' } }, (req) => {
			if (req.method === 'POST') return running(requestIdOf(req));
			throw new Error(`unexpected ${req.method} ${req.url}`);
		});
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(requestIdOf(posts()[0])).toBe('my-id-1');
	});
});

describe('visibility never falls back to the API default (Workspace)', () => {
	const post = (req: IHttpRequestOptions) => {
		if (req.url.includes('/requests/')) throw notFound();
		return running(requestIdOf(req));
	};

	it('an empty value sends PRIVATE', async () => {
		const { ctx, posts } = context(3, { visibility: '' }, post);
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect((posts()[0].body as Params).visibility).toBe('PRIVATE');
	});

	it.each(['public', 'everyone'])('%s stops before anything is created', async (value) => {
		const { ctx, requests } = context(3, { visibility: value }, post);
		await expect(createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' })).rejects.toThrow(
			`'Visibility' must be Private, Project or Workspace, not '${value}'`,
		);
		expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
	});

	it('Update refuses public', async () => {
		const { ctx, requests } = context(
			3,
			{ presentation: DECK, updateFields: { visibility: 'public' } },
			() => ({}),
		);
		await expect(presentation.update.execute.call(ctx, 0)).rejects.toThrow(
			"'Visibility' must be Private, Project or Workspace, not 'public'",
		);
		expect(requests.filter((r) => r.method === 'PATCH')).toHaveLength(0);
	});
});

describe('retries', () => {
	const call = (method: 'GET' | 'POST', path: string, failures: unknown[]) => {
		let calls = 0;
		const { ctx } = context(3, {}, () => {
			const failure = failures[calls++];
			if (failure) throw failure;
			return { ok: true };
		});
		return {
			run: async () => await apiRequest.call(ctx, method, path),
			calls: () => calls,
		};
	};
	const limited = () =>
		httpError(429, { code: 'RATE_LIMITED', message: 'Slow down' }, { 'retry-after': '0' });
	const outage = () =>
		httpError(503, { code: 'SERVICE_UNAVAILABLE', message: 'Down' }, { 'retry-after': '0' });

	it('sends a rate-limited request again', async () => {
		const c = call('POST', '/files', [limited()]);
		await expect(c.run()).resolves.toEqual({ ok: true });
		expect(c.calls()).toBe(2);
	});

	it('retries a create after an outage, since the same Request-Id replays', async () => {
		const c = call('POST', '/decks', [outage(), outage()]);
		await expect(c.run()).resolves.toEqual({ ok: true });
		expect(c.calls()).toBe(3);
	});

	it("doesn't retry an upload after an outage", async () => {
		const c = call('POST', '/files', [outage()]);
		await expect(c.run()).rejects.toThrow('Down');
		expect(c.calls()).toBe(1);
	});

	it('gives up after three attempts', async () => {
		const c = call('GET', '/decks', [limited(), limited(), limited(), limited()]);
		await expect(c.run()).rejects.toMatchObject({
			description: expect.stringContaining('200 requests a minute'),
		});
		expect(c.calls()).toBe(3);
	});
});

describe('error hints', () => {
	const errorFor = async (status: number, error: Params) => {
		const { ctx } = context(3, {}, () => {
			throw httpError(status, error);
		});
		try {
			await apiRequest.call(ctx, 'GET', '/me/x');
		} catch (caught) {
			return caught as { message: string; description?: string };
		}
		throw new Error('expected a failure');
	};

	it('says a suspended workspace needs billing, not a new key', async () => {
		const error = await errorFor(401, {
			code: 'UNAUTHENTICATED',
			message: 'workspace is suspended',
		});
		expect(error.description).toContain('workspace is suspended');
		expect(error.description).toContain('Check billing');
		expect(error.description).not.toContain('Create a new API key');
	});

	it('says a suspended workspace needs billing when it tries to spend (403)', async () => {
		const error = await errorFor(403, {
			code: 'WORKSPACE_SUSPENDED',
			message: 'Workspace is suspended for non-payment.',
		});
		expect(error.description).toContain('Check billing');
		expect(error.description).toContain('Code: WORKSPACE_SUSPENDED');
		expect(error.description).not.toContain('Create a key with the Deck automation preset');
	});

	it('still points a plain 401 to a new key', async () => {
		const error = await errorFor(401, { code: 'UNAUTHENTICATED', message: 'invalid api key' });
		expect(error.description).toContain('Create a new API key');
	});

	it.each([
		['CONTENT_TOO_LONG', 422, 'longer than Presentations.AI accepts'],
		['SOURCES_NOT_READY', 409, 'still being read'],
		['SOURCE_FAILED', 422, "couldn't read a file"],
	])('%s says what to do next', async (code, status, hint) => {
		const error = await errorFor(status, { code, message: 'API message' });
		expect(error.description).toContain(hint);
	});
});

describe('presentation URLs', () => {
	it('takes the ID after /decks/, not a later one', () => {
		expect(
			deckIdFrom(
				`https://app.example.com/decks/${DECK}/slides/7c9e6679-7425-40de-944b-e07fc1f90ae7`,
			),
		).toBe(DECK);
	});

	it('matches the URL picker', () => {
		const locator = new PresentationsAi().description.properties
			.flatMap((p) => ('modes' in p && p.modes ? p.modes : []))
			.find((m) => m.name === 'url');
		const regex = new RegExp((locator?.extractValue as { regex: string }).regex);
		const url = `https://app.example.com/w/7c9e6679-7425-40de-944b-e07fc1f90ae7/decks/${DECK}/slides/2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90`;
		expect(regex.exec(url)?.[1]).toBe(DECK);
		expect(deckIdFrom(url)).toBe(DECK);
	});

	it('ignores IDs in the query string', () => {
		const url = `https://app.example.com/x/${DECK}?ref=7c9e6679-7425-40de-944b-e07fc1f90ae7`;
		const locator = new PresentationsAi().description.properties
			.flatMap((p) => ('modes' in p && p.modes ? p.modes : []))
			.find((m) => m.name === 'url');
		const regex = new RegExp((locator?.extractValue as { regex: string }).regex);
		expect(regex.exec(url)?.[1]).toBe(DECK);
		expect(deckIdFrom(url)).toBe(DECK);
	});
});

describe('templates', () => {
	const dir = join(__dirname, '..', 'examples');
	const { description } = new PresentationsAi();
	const latest = description.defaultVersion;

	it.each(readdirSync(dir).filter((f) => f.endsWith('.json')))(
		'%s uses the newest Presentations.AI node version',
		(file) => {
			const workflow = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
				nodes: Array<{ type: string; typeVersion: number; name: string }>;
			};
			for (const node of workflow.nodes.filter((n) => n.type.startsWith('@presentations-ai/'))) {
				expect({ node: node.name, typeVersion: node.typeVersion }).toEqual({
					node: node.name,
					typeVersion: latest,
				});
			}
		},
	);
});

describe('review follow-ups', () => {
	const fresh = (req: IHttpRequestOptions) => {
		if (req.url.includes('/requests/')) throw notFound();
		if (req.method === 'POST' && req.url.endsWith('/files'))
			return { file_id: 'file-1', filename: 'report.md', status: 'COMPLETED', created_at: 'x' };
		if (req.method === 'POST') return running(requestIdOf(req));
		throw new Error(`unexpected ${req.method} ${req.url}`);
	};

	it("version 3 refuses the old 'share' format instead of making a public link", async () => {
		const { ctx, requests } = context(3, { exportType: 'share' }, fresh);
		await expect(createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' })).rejects.toThrow(
			"'Export Format' can't be 'share'",
		);
		expect(requests.filter((r) => r.method === 'POST')).toHaveLength(0);
	});

	it("version 1 still turns the old 'share' format into a share link", async () => {
		const { ctx, requests } = context(
			1,
			{ exportType: 'share', waitForCompletion: true },
			(req) => {
				if (req.url.endsWith('/share-link')) return { url: 'https://share.example.com/x' };
				if (req.method === 'POST') return running(requestIdOf(req), 'COMPLETED');
				throw new Error(`unexpected ${req.method} ${req.url}`);
			},
		);
		const item = await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(requests.some((r) => r.url.endsWith('/share-link'))).toBe(true);
		expect(item.json.share_url).toBe('https://share.example.com/x');
	});

	it('version 3 sends auto when Language is empty', async () => {
		const { ctx, posts } = context(3, { language: '' }, fresh);
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect((posts()[0].body as Params).language).toBe('auto');
	});

	it('version 3 with a file: same content, same ID, and no new upload when it already exists', async () => {
		const first = context(3, { fileText: 'same text' }, fresh);
		await createDeckForItem.call(
			first.ctx,
			0,
			{ preservationMode: 'summarize' },
			{ binaryProperty: 'data' },
		);
		const firstId = requestIdOf(first.posts()[0]);
		expect(first.requests.filter((r) => r.url.endsWith('/files'))).toHaveLength(1);

		const replay = context(3, { fileText: 'same text' }, (req) => {
			if (req.url.includes('/requests/')) return running(firstId, 'COMPLETED');
			if (req.url.endsWith('/decks/deck-1')) return { id: 'deck-1' };
			throw new Error(`unexpected ${req.method} ${req.url}`);
		});
		await createDeckForItem.call(
			replay.ctx,
			0,
			{ preservationMode: 'summarize' },
			{ binaryProperty: 'data' },
		);
		expect(replay.requests.filter((r) => r.method === 'POST')).toHaveLength(0);
		expect(replay.requests[1].url).toContain(firstId);

		const changed = context(3, { fileText: 'other text' }, fresh);
		await createDeckForItem.call(
			changed.ctx,
			0,
			{ preservationMode: 'summarize' },
			{ binaryProperty: 'data' },
		);
		expect(requestIdOf(changed.posts()[0])).not.toBe(firstId);
	});

	it('Retry On Fail after a failure gets the same failure, not a new generation', async () => {
		let base = '';
		const route = (req: IHttpRequestOptions) => {
			if (req.url.includes('/requests/')) {
				const id = decodeURIComponent(req.url.split('/').pop()!);
				if (base && id === base) return running(id, 'FAILED');
				throw notFound();
			}
			if (req.method === 'POST') {
				base ||= requestIdOf(req);
				return running(requestIdOf(req), 'FAILED');
			}
			throw new Error(`unexpected ${req.method} ${req.url}`);
		};
		const first = context(3, {}, route, 'pai_live_test', { project_id: null }, 'exec-retry');
		await expect(createDeckForItem.call(first.ctx, 0, { topic: 'Q3 plan' })).rejects.toThrow(
			'boom',
		);
		const retry = context(3, {}, route, 'pai_live_test', { project_id: null }, 'exec-retry');
		await expect(createDeckForItem.call(retry.ctx, 0, { topic: 'Q3 plan' })).rejects.toThrow(
			'boom',
		);
		expect(retry.posts()).toHaveLength(0);
		const nextRun = context(3, {}, route, 'pai_live_test', { project_id: null }, 'exec-later');
		await createDeckForItem.call(nextRun.ctx, 0, { topic: 'Q3 plan' }).catch(() => undefined);
		expect(requestIdOf(nextRun.posts()[0])).toBe(`${base}-2`);
	});

	it('version 3 IDs follow the user, not the key', async () => {
		const me = { project_id: null, user_id: 'u1', workspace_id: 'w1' };
		const a = context(3, {}, fresh, 'pai_live_key_a', me);
		const b = context(3, {}, fresh, 'pai_live_key_b', me);
		await createDeckForItem.call(a.ctx, 0, { topic: 'Q3 plan' });
		await createDeckForItem.call(b.ctx, 0, { topic: 'Q3 plan' });
		expect(requestIdOf(a.posts()[0])).toBe(requestIdOf(b.posts()[0]));
	});
});
