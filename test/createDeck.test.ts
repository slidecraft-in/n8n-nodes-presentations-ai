import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { createDeckForItem } from '../nodes/PresentationsAi/actions/deck';

type Params = Record<string, unknown>;

// A minimal execute context: enough for createDeckForItem to build the body,
// look up the key's project and submit without waiting.
function context(typeVersion: number, params: Params, keyProject: string | null = null) {
	const requests: IHttpRequestOptions[] = [];
	const httpRequestWithAuthentication = vi.fn(async (_cred: string, req: IHttpRequestOptions) => {
		requests.push(req);
		if (req.url.endsWith('/me')) return { project_id: keyProject };
		if (req.method === 'POST' && req.url.endsWith('/decks')) {
			return {
				request_id: 'req-1',
				deck_id: 'deck-1',
				status: 'RUNNING',
				stage: 'OUTLINE',
				status_url: 'https://api.example.com/api/v1/requests/req-1',
				deck_url: 'https://app.example.com/deck-1',
				error: null,
				created_at: '2026-11-13T00:00:00Z',
				updated_at: '2026-11-13T00:00:00Z',
			};
		}
		throw new Error(`unexpected request ${req.method} ${req.url}`);
	});
	const values: Params = { waitForCompletion: false, simplify: true, options: {}, ...params };
	const ctx = {
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in values ? values[name] : fallback,
		getNode: () => ({ id: 'node-1', name: 'Presentations.AI', typeVersion, type: 't', position: [0, 0], parameters: {} }),
		getCredentials: async () => ({ apiKey: 'pai_live_test', baseUrl: 'https://api.example.com' }),
		getInstanceId: () => 'instance-1',
		getWorkflow: () => ({ id: 'workflow-1' }),
		getExecutionId: () => 'execution-1',
		getWorkflowDataProxy: () => ({ $thisRunIndex: 0 }),
		helpers: { httpRequestWithAuthentication },
	} as unknown as IExecuteFunctions;
	const deckBody = () =>
		requests.find((r) => r.method === 'POST' && r.url.endsWith('/decks'))?.body as
			| Record<string, unknown>
			| undefined;
	return { ctx, deckBody };
}

describe('createDeckForItem visibility and language by node version', () => {
	it('version 1 sends no visibility, so decks stay workspace-visible', async () => {
		const { ctx, deckBody } = context(1, { language: 'English' });
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(deckBody()).not.toHaveProperty('visibility');
		expect(deckBody()?.language).toBe('English');
	});

	it('version 2 sends PRIVATE by default and auto for language', async () => {
		const { ctx, deckBody } = context(2, { language: 'auto' });
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(deckBody()?.visibility).toBe('PRIVATE');
		expect(deckBody()?.language).toBe('auto');
	});

	it('version 2 sends WORKSPACE when chosen', async () => {
		const { ctx, deckBody } = context(2, { visibility: 'workspace' });
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(deckBody()?.visibility).toBe('WORKSPACE');
	});

	it('version 2 Project visibility uses the chosen project', async () => {
		const project = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
		const { ctx, deckBody } = context(2, {
			visibility: 'project',
			options: { projectId: { mode: 'id', value: project } },
		});
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(deckBody()).toMatchObject({ visibility: 'PROJECT', project_id: project });
	});

	it("version 2 Project visibility falls back to the key's own project", async () => {
		const project = '2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90';
		const { ctx, deckBody } = context(2, { visibility: 'project' }, project);
		await createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' });
		expect(deckBody()).toMatchObject({ visibility: 'PROJECT', project_id: project });
	});

	it('version 2 Project visibility without any project stops before creating a deck', async () => {
		const { ctx, deckBody } = context(2, { visibility: 'project' });
		await expect(createDeckForItem.call(ctx, 0, { topic: 'Q3 plan' })).rejects.toThrow(
			"'Visibility' is 'Project', but no project is set",
		);
		expect(deckBody()).toBeUndefined();
	});
});
