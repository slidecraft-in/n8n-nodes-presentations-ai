import type { IExecuteFunctions } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

// n8n before 2.34 has a sleep(ms) that ignores the abort signal. Stand that in
// so the test proves polling still stops when the workflow is cancelled.
vi.mock('n8n-workflow', async (importOriginal) => ({
	...(await importOriginal<typeof import('n8n-workflow')>()),
	sleep: vi.fn(async () => {}),
}));

const { waitForRequest } = await import('../nodes/PresentationsAi/transport');

function context(signal: AbortSignal) {
	const httpRequestWithAuthentication = vi.fn(async () => ({ request_id: 'r', status: 'RUNNING' }));
	const ctx = {
		getNode: () => ({ name: 'Presentations.AI', type: 'x', typeVersion: 1 }),
		getExecutionCancelSignal: () => signal,
		getCredentials: async () => ({ apiKey: 'pai_live_test', baseUrl: 'https://api.example.com' }),
		helpers: { httpRequestWithAuthentication },
	} as unknown as IExecuteFunctions;
	return { ctx, httpRequestWithAuthentication };
}

describe('polling', () => {
	it('stops when the workflow is cancelled, even if sleep ignores the signal', async () => {
		const controller = new AbortController();
		controller.abort();
		const { ctx, httpRequestWithAuthentication } = context(controller.signal);
		await expect(
			waitForRequest.call(ctx, { request_id: 'r', status: 'RUNNING' } as never, Date.now() + 60_000),
		).rejects.toThrow();
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('keeps polling until the request settles', async () => {
		const controller = new AbortController();
		const { ctx, httpRequestWithAuthentication } = context(controller.signal);
		httpRequestWithAuthentication
			.mockResolvedValueOnce({ request_id: 'r', status: 'RUNNING' })
			.mockResolvedValueOnce({ request_id: 'r', status: 'COMPLETED' });
		const result = await waitForRequest.call(
			ctx,
			{ request_id: 'r', status: 'RUNNING' } as never,
			Date.now() + 60_000,
		);
		expect(result.status).toBe('COMPLETED');
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
	});
});
