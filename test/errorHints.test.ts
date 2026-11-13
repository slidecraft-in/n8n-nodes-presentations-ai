import type { IExecuteFunctions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { apiRequest } from '../nodes/PresentationsAi/transport';

// A context whose HTTP call fails the way n8n reports an API error response.
function failing(status: number, error: Record<string, unknown>) {
	return {
		getNode: () => ({
			id: 'n1',
			name: 'Presentations.AI',
			typeVersion: 3,
			type: 't',
			position: [0, 0],
			parameters: {},
		}),
		getCredentials: async () => ({ apiKey: 'pai_live_test', baseUrl: 'https://api.example.com' }),
		getExecutionCancelSignal: () => undefined,
		helpers: {
			httpRequestWithAuthentication: async () => {
				throw Object.assign(new Error(`Request failed with status code ${status}`), {
					httpCode: String(status),
					response: { status, data: { error } },
				});
			},
		},
	} as unknown as IExecuteFunctions;
}

async function errorFor(status: number, error: Record<string, unknown>) {
	try {
		await apiRequest.call(failing(status, error), 'POST', '/decks');
	} catch (caught) {
		return caught as { message: string; description?: string };
	}
	throw new Error('expected the request to fail');
}

describe('API error hints', () => {
	it.each([
		['FEATURE_NOT_IN_PLAN', 403, "plan doesn't include an option you chose"],
		['PLAN_LIMIT_EXCEEDED', 403, 'goes over a limit of your Presentations.AI plan'],
		['WORKSPACE_SUSPENDED', 403, 'workspace is suspended'],
		['FORBIDDEN', 403, "Your API key doesn't allow this"],
		['INSUFFICIENT_CREDITS', 402, 'no credits left'],
		['REQUEST_ID_CONFLICT', 409, 'already used with different inputs'],
	])('%s says what to do next', async (code, status, hint) => {
		const error = await errorFor(status, { code, message: 'API message', trace_id: 't1' });
		expect(error.message).toBe('API message');
		expect(error.description).toContain(hint);
		expect(error.description).toContain(`Code: ${code}`);
	});

	it('names missing scopes when the API sends them', async () => {
		const error = await errorFor(403, {
			code: 'FORBIDDEN',
			message: 'Missing scope',
			details: { required_scopes: ['decks:write', 'files:write'] },
		});
		expect(error.description).toContain('Scopes the API key needs: decks:write, files:write');
	});

	it('adds no hint for codes it has none for', async () => {
		const error = await errorFor(400, { code: 'VALIDATION_FAILED', message: 'Bad slide count' });
		expect(error.description).toBe('Code: VALIDATION_FAILED');
	});
});
