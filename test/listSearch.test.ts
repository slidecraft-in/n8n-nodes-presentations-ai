import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { searchBrandKits, searchProjects } from '../nodes/PresentationsAi/methods/listSearch';

type Request = { url: string; qs: Record<string, string | number> };

// Minimal stand-in for n8n's load-options context: serves pages by number.
function fakeContext(pages: Record<number, unknown>, requests: Request[] = []) {
	return {
		getCredentials: async () => ({ apiKey: 'unused', baseUrl: 'https://api.example.com' }),
		getNode: () => ({ name: 'Presentations.AI', type: 'test', typeVersion: 1, parameters: {} }),
		helpers: {
			httpRequestWithAuthentication: async (_type: string, options: Request) => {
				requests.push(options);
				return pages[Number(options.qs.page)];
			},
		},
	} as unknown as ILoadOptionsFunctions;
}

const project = (n: number, extra: Record<string, unknown> = {}) => ({
	id: `p${n}`,
	name: `Project ${n}`,
	...extra,
});
const page = (data: unknown[], total: number) => ({ data, page: 1, limit: 200, total });

describe('searchProjects', () => {
	it('returns one page and a token for the next when browsing', async () => {
		const requests: Request[] = [];
		const ctx = fakeContext(
			{ 1: page([project(1), project(2, { archived_at: '2026-01-01' })], 450) },
			requests,
		);
		const result = await searchProjects.call(ctx);
		expect(result.results).toEqual([{ name: 'Project 1', value: 'p1' }]);
		expect(result.paginationToken).toBe('2');
		expect(requests[0].url).toBe('https://api.example.com/api/v1/projects');
		expect(requests[0].qs).toMatchObject({ kind: 'PROJECT', page: 1, limit: 200 });
	});

	it('reads further pages until a search term matches', async () => {
		const ctx = fakeContext({
			1: page([project(1)], 450),
			2: page([project(2)], 450),
			3: page([project(250)], 450),
		});
		const result = await searchProjects.call(ctx, '250');
		expect(result.results).toEqual([{ name: 'Project 250', value: 'p250' }]);
		expect(result.paginationToken).toBeUndefined();
	});

	it('continues from a pagination token', async () => {
		const requests: Request[] = [];
		const ctx = fakeContext({ 3: page([project(401)], 450) }, requests);
		const result = await searchProjects.call(ctx, undefined, '3');
		expect(requests[0].qs.page).toBe(3);
		expect(result.results).toHaveLength(1);
		expect(result.paginationToken).toBeUndefined();
	});
});

describe('searchBrandKits', () => {
	it('sends the search term and labels kits with their domain', async () => {
		const requests: Request[] = [];
		const ctx = fakeContext(
			{
				1: {
					data: [
						{ id: 'k1', name: 'Example', domain: 'example.com' },
						{ id: 'k2', name: 'Plain' },
					],
					page: 1,
					limit: 50,
					total: 60,
				},
			},
			requests,
		);
		const result = await searchBrandKits.call(ctx, ' example ');
		expect(requests[0].qs).toMatchObject({ q: 'example', page: 1, limit: 50 });
		expect(result.results).toEqual([
			{ name: 'Example (example.com)', value: 'k1' },
			{ name: 'Plain', value: 'k2' },
		]);
		expect(result.paginationToken).toBe('2');
	});
});
