import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeProperties,
	INodePropertyOptions,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeHelpers } from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

// File → Upload polls until the file is read; skip the 5-second waits.
vi.mock('n8n-workflow', async (importOriginal) => ({
	...(await importOriginal<typeof import('n8n-workflow')>()),
	sleep: vi.fn(async () => {}),
}));

import * as access from '../nodes/PresentationsAi/actions/access';
import * as account from '../nodes/PresentationsAi/actions/account';
import * as brandKit from '../nodes/PresentationsAi/actions/brandKit';
import * as file from '../nodes/PresentationsAi/actions/file';
import * as presentation from '../nodes/PresentationsAi/actions/presentation';
import * as project from '../nodes/PresentationsAi/actions/project';
import { router } from '../nodes/PresentationsAi/actions/router';
import * as shareLink from '../nodes/PresentationsAi/actions/shareLink';
import { PresentationsAi } from '../nodes/PresentationsAi/PresentationsAi.node';

const API = 'https://api.example.com/api/v1';
const DECK_ID = '01a1d3ca-a7af-7016-a8fe-c79fdbf5136c';
const GRANT_ID = '9b1f2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

type Route = (req: IHttpRequestOptions) => unknown;

function context(
	params: Record<string, unknown>,
	route: Route,
	extra: { binary?: Record<string, { fileName?: string; mimeType: string }> } = {},
) {
	const requests: IHttpRequestOptions[] = [];
	const ctx = {
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in params ? params[name] : fallback,
		getNode: () => ({
			id: 'n1',
			name: 'Presentations.AI',
			typeVersion: 3,
			type: 't',
			position: [0, 0],
			parameters: {},
		}),
		getInputData: () => [{ json: {}, binary: extra.binary }],
		getCredentials: async () => ({ apiKey: 'pai_live_test', baseUrl: 'https://api.example.com' }),
		getExecutionCancelSignal: () => undefined,
		continueOnFail: () => false,
		addExecutionHints: vi.fn(),
		helpers: {
			httpRequestWithAuthentication: vi.fn(async (_c: string, req: IHttpRequestOptions) => {
				requests.push(req);
				return route(req);
			}),
			assertBinaryData: (_i: number, field: string) => extra.binary?.[field],
			getBinaryDataBuffer: async () => Buffer.from('hello'),
		},
	} as unknown as IExecuteFunctions;
	return { ctx, requests };
}

// How n8n's HTTP client fails: the status and the API's error envelope.
function httpError(status: number, code: string, message = 'Not found') {
	return Object.assign(new Error(message), {
		httpCode: String(status),
		response: { status, data: { error: { code, message } } },
	});
}

const deckParam = { presentation: { mode: 'id', value: DECK_ID } };

describe('Account', () => {
	const me = {
		user_id: 'u1',
		email: 'a@example.com',
		workspace_id: 'w1',
		project_id: null,
		api_key_id: 'k1',
		role_at_issuance: 'OWNER',
		scopes: ['decks:write'],
		permissions: ['x'],
		plan: 'PRO',
		max_model: 'PRO',
		plan_features: ['EXPORT_PPTX'],
	};

	it('Get reads /me and keeps nine fields when simplified', async () => {
		const { ctx, requests } = context({ simplify: true }, () => me);
		const [item] = await account.get.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'GET', url: `${API}/me` });
		expect(item.json).toEqual({
			user_id: 'u1',
			email: 'a@example.com',
			workspace_id: 'w1',
			project_id: null,
			plan: 'PRO',
			max_model: 'PRO',
			plan_features: ['EXPORT_PPTX'],
			scopes: ['decks:write'],
			role_at_issuance: 'OWNER',
		});
		expect(item.pairedItem).toEqual({ item: 0 });
	});

	it('Get returns the raw response with Simplify off', async () => {
		const { ctx } = context({ simplify: false }, () => me);
		const [item] = await account.get.execute.call(ctx, 0);
		expect(item.json).toEqual(me);
	});

	it.each([
		[25, true],
		[0, false],
		[-10, false],
	])('Get Credits with %d available -> can_start_paid_work %s', async (available, canStart) => {
		const { ctx, requests } = context({}, () => ({
			workspace_id: 'w1',
			available,
			active_granted: 100,
			total_consumed: 75,
			active_holds: 0,
		}));
		const [item] = await account.getCredits.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'GET', url: `${API}/credits` });
		expect(item.json).toEqual({
			workspace_id: 'w1',
			available,
			active_granted: 100,
			total_consumed: 75,
			can_start_paid_work: canStart,
		});
	});
});

const projectOf = (n: number, name = `Project ${n}`) => ({
	id: `p${n}`,
	kind: 'PROJECT',
	parent_id: null,
	workspace_id: 'w1',
	name,
	slug: `project-${n}`,
	default_member_role: 'VIEWER',
	workspace_visible: true,
	created_by: 'u1',
	archived_at: null,
	created_at: '2026-11-13T00:00:00Z',
	has_share_link: false,
});

describe('Project', () => {
	it('Get reads the project from the locator and simplifies it to ten fields', async () => {
		const { ctx, requests } = context(
			{ project: { mode: 'id', value: 'p1' }, simplify: true },
			() => projectOf(1),
		);
		const [item] = await project.get.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'GET', url: `${API}/projects/p1` });
		expect(Object.keys(item.json)).toHaveLength(10);
		expect(item.json).not.toHaveProperty('created_by');
		expect(item.json).toMatchObject({ id: 'p1', kind: 'PROJECT', slug: 'project-1' });
	});

	it('Get stops before calling the API when no project is chosen', async () => {
		const { ctx, requests } = context({ project: { mode: 'list', value: '' } }, () => ({}));
		await expect(project.get.execute.call(ctx, 0)).rejects.toThrow(
			"The 'Project' parameter is empty",
		);
		expect(requests).toHaveLength(0);
	});

	const pages =
		(total: number, name = (i: number) => `Project ${i}`) =>
		(req: IHttpRequestOptions) => {
			const { page, limit } = req.qs as { page: number; limit: number };
			const start = (page - 1) * limit;
			const count = Math.max(0, Math.min(limit, total - start));
			return {
				data: Array.from({ length: count }, (_, i) => projectOf(start + i, name(start + i))),
				page,
				limit,
				total,
			};
		};

	it('Get Many pages with a fixed page size of 200 until all are read', async () => {
		const { ctx, requests } = context(
			{ returnAll: true, filters: {}, simplify: false },
			pages(450),
		);
		const items = await project.getMany.execute.call(ctx, 0);
		expect(items).toHaveLength(450);
		expect(requests.map((r) => r.qs)).toEqual([
			{ kind: 'PROJECT', page: 1, limit: 200 },
			{ kind: 'PROJECT', page: 2, limit: 200 },
			{ kind: 'PROJECT', page: 3, limit: 200 },
		]);
	});

	it('Get Many asks only for the limit and sends the kind', async () => {
		const { ctx, requests } = context(
			{ returnAll: false, limit: 5, filters: { kind: 'FOLDER' } },
			pages(450),
		);
		const items = await project.getMany.execute.call(ctx, 0);
		expect(items).toHaveLength(5);
		expect(requests).toHaveLength(1);
		expect(requests[0]).toMatchObject({ url: `${API}/projects` });
		expect(requests[0].qs).toEqual({ kind: 'FOLDER', page: 1, limit: 5 });
	});

	it('Get Many searches names on the node, reading further pages for matches', async () => {
		const { ctx, requests } = context(
			{ returnAll: false, limit: 2, filters: { search: 'SALES' } },
			pages(450, (i) => (i === 10 || i === 300 || i === 301 ? `Sales ${i}` : `Other ${i}`)),
		);
		const items = await project.getMany.execute.call(ctx, 0);
		expect(items.map((i) => i.json.id)).toEqual(['p10', 'p300']);
		expect(requests).toHaveLength(2);
		// No search parameter is sent; the API has none.
		expect(requests[0].qs).toEqual({ kind: 'PROJECT', page: 1, limit: 200 });
	});
});

const kit = (n: number) => ({
	id: `b${n}`,
	name: `Kit ${n}`,
	domain: 'example.com',
	type: 'WORKSPACE',
	access: 'READ',
	logo_url: null,
	colors: ['#000000'],
});

describe('Brand Kit', () => {
	it('Get reads the brand kit from the locator', async () => {
		const { ctx, requests } = context({ brandKit: { mode: 'list', value: 'b1' } }, () => ({
			...kit(1),
			description: 'Ours',
		}));
		const [item] = await brandKit.get.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'GET', url: `${API}/brand-kits/b1` });
		expect(item.json).toMatchObject({ id: 'b1', description: 'Ours' });
	});

	it('Get stops when no brand kit is chosen', async () => {
		const { ctx } = context({ brandKit: { mode: 'list', value: '' } }, () => ({}));
		await expect(brandKit.get.execute.call(ctx, 0)).rejects.toThrow(
			"The 'Brand Kit' parameter is empty",
		);
	});

	it('Get Many maps the filters onto the query', async () => {
		const { ctx, requests } = context(
			{
				returnAll: false,
				limit: 3,
				filters: { search: ' acme ', domain: 'acme.com', type: 'CATALOG' },
			},
			() => ({ data: [kit(1)], page: 1, limit: 3, total: 1 }),
		);
		const items = await brandKit.getMany.execute.call(ctx, 0);
		expect(items).toHaveLength(1);
		expect(requests[0]).toMatchObject({ method: 'GET', url: `${API}/brand-kits` });
		expect(requests[0].qs).toEqual({
			q: 'acme',
			domain: 'acme.com',
			type: 'CATALOG',
			page: 1,
			limit: 3,
		});
	});

	it('Get Many with Return All pages 100 at a time', async () => {
		const { ctx, requests } = context({ returnAll: true, filters: {} }, (req) => {
			const { page } = req.qs as { page: number };
			const count = page < 3 ? 100 : 30;
			return {
				data: Array.from({ length: count }, (_, i) => kit(i)),
				page,
				limit: 100,
				total: 230,
			};
		});
		const items = await brandKit.getMany.execute.call(ctx, 0);
		expect(items).toHaveLength(230);
		expect(requests.map((r) => (r.qs as { page: number; limit: number }).limit)).toEqual([
			100, 100, 100,
		]);
	});

	it('Get Many refuses a search over 100 characters before calling the API', async () => {
		const { ctx, requests } = context({ filters: { search: 'x'.repeat(101) } }, () => ({}));
		await expect(brandKit.getMany.execute.call(ctx, 0)).rejects.toThrow(
			"The 'Search' filter is too long",
		);
		expect(requests).toHaveLength(0);
	});

	it('Get Many refuses an unknown type', async () => {
		const { ctx } = context({ filters: { type: 'public' } }, () => ({}));
		await expect(brandKit.getMany.execute.call(ctx, 0)).rejects.toThrow(
			"'Type' must be Catalog, Personal or Workspace, not 'public'",
		);
	});
});

describe('File', () => {
	const binary = { data: { fileName: 'notes.pdf', mimeType: 'application/pdf' } };
	const fileRecord = (status: string, extra: Record<string, unknown> = {}) => ({
		file_id: 'f1',
		filename: 'notes.pdf',
		status,
		error: null,
		size_bytes: 5,
		content_type: 'application/pdf',
		char_count: 1200,
		content_sha256: 'abc',
		extracted_at: '2026-11-13T00:00:00Z',
		created_at: '2026-11-13T00:00:00Z',
		...extra,
	});

	it('Upload sends the binary as multipart and waits until the file is read', async () => {
		let reads = 0;
		const { ctx, requests } = context(
			{ binaryProperty: 'data', waitForReady: true },
			(req) => {
				if (req.method === 'POST')
					return { file_id: 'f1', filename: 'notes.pdf', status: 'CREATED', created_at: 'x' };
				reads++;
				return fileRecord(reads < 2 ? 'RUNNING' : 'COMPLETED');
			},
			{ binary },
		);
		const [item] = await file.upload.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'POST', url: `${API}/files` });
		expect(requests[0].body).toBeInstanceOf(FormData);
		expect(((requests[0].body as FormData).get('file') as File).name).toBe('notes.pdf');
		expect(requests.slice(1).every((r) => r.method === 'GET' && r.url === `${API}/files/f1`)).toBe(
			true,
		);
		expect(item.json).toEqual({
			file_id: 'f1',
			filename: 'notes.pdf',
			status: 'COMPLETED',
			error: null,
			char_count: 1200,
			size_bytes: 5,
			content_type: 'application/pdf',
		});
		expect(item.pairedItem).toEqual({ item: 0 });
	});

	it('Upload without waiting returns the upload response at once', async () => {
		const { ctx, requests } = context(
			{ binaryProperty: 'data', waitForReady: false },
			() => ({ file_id: 'f1', filename: 'notes.pdf', status: 'CREATED', created_at: 'x' }),
			{ binary },
		);
		const [item] = await file.upload.execute.call(ctx, 0);
		expect(requests).toHaveLength(1);
		expect(item.json).toEqual({
			file_id: 'f1',
			filename: 'notes.pdf',
			status: 'CREATED',
			error: null,
			char_count: null,
			size_bytes: null,
			content_type: null,
		});
	});

	it("Upload fails with the reason when the file can't be read", async () => {
		const { ctx } = context(
			{ binaryProperty: 'data', waitForReady: true },
			(req) =>
				req.method === 'POST'
					? { file_id: 'f1', filename: 'notes.pdf', status: 'CREATED', created_at: 'x' }
					: fileRecord('FAILED', { error: 'Encrypted PDF' }),
			{ binary },
		);
		await expect(file.upload.execute.call(ctx, 0)).rejects.toThrow(
			'Presentations.AI couldn\'t read the file "notes.pdf"',
		);
	});

	it('Upload names the fields the item has when the binary field is missing', async () => {
		const { ctx, requests } = context({ binaryProperty: 'document' }, () => ({}), { binary });
		await expect(file.upload.execute.call(ctx, 0)).rejects.toThrow(
			"No file in the 'document' field",
		);
		expect(requests).toHaveLength(0);
	});

	it('Get reads the file by ID', async () => {
		const { ctx, requests } = context({ fileId: ' f1 ' }, () => fileRecord('COMPLETED'));
		const [item] = await file.get.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'GET', url: `${API}/files/f1` });
		expect(item.json).toMatchObject({ file_id: 'f1', status: 'COMPLETED' });
	});

	it('Get stops when the file ID is empty', async () => {
		const { ctx } = context({ fileId: '' }, () => ({}));
		await expect(file.get.execute.call(ctx, 0)).rejects.toThrow("The 'File ID' parameter is empty");
	});

	it('Delete sends DELETE and reports it', async () => {
		const { ctx, requests } = context({ fileId: 'f1' }, () => undefined);
		const [item] = await file.delete.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'DELETE', url: `${API}/files/f1` });
		expect(item.json).toEqual({ file_id: 'f1', deleted: true });
	});
});

describe('Share Link', () => {
	const linkUrl = 'https://app.example.com/s/abc';

	it('Create reuses the existing link by default', async () => {
		const { ctx, requests } = context({ ...deckParam, rotate: false }, () => ({ url: linkUrl }));
		const [item] = await shareLink.create.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({
			method: 'POST',
			url: `${API}/decks/${DECK_ID}/share-link`,
		});
		expect(requests[0].qs).toBeUndefined();
		expect(item.json).toEqual({ deck_id: DECK_ID, url: linkUrl });
	});

	it('Create with a new link sends rotate=true', async () => {
		const { ctx, requests } = context({ ...deckParam, rotate: true }, () => ({ url: linkUrl }));
		await shareLink.create.execute.call(ctx, 0);
		expect(requests[0].qs).toEqual({ rotate: true });
	});

	it('Get returns the link', async () => {
		const { ctx, requests } = context(deckParam, () => ({
			url: linkUrl,
			password_set: false,
			expires_at: null,
		}));
		const [item] = await shareLink.get.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({
			method: 'GET',
			url: `${API}/decks/${DECK_ID}/share-link`,
		});
		expect(item.json).toEqual({ deck_id: DECK_ID, url: linkUrl, has_share_link: true });
	});

	it('Get returns url null when link sharing is off (404) and the presentation exists', async () => {
		const { ctx, requests } = context(deckParam, (req) => {
			if (req.url.endsWith('/share-link')) throw httpError(404, 'NOT_FOUND');
			return { id: DECK_ID, name: 'Q3', status: 'COMPLETED', exports: [] };
		});
		const [item] = await shareLink.get.execute.call(ctx, 0);
		expect(item.json).toEqual({ deck_id: DECK_ID, url: null, has_share_link: false });
		expect(requests.map((r) => r.url)).toEqual([
			`${API}/decks/${DECK_ID}/share-link`,
			`${API}/decks/${DECK_ID}`,
		]);
	});

	it('Get fails when the presentation itself is not found', async () => {
		const { ctx } = context(deckParam, (req) => {
			throw httpError(404, 'NOT_FOUND', req.url.endsWith('/share-link') ? 'No link' : 'No deck');
		});
		await expect(shareLink.get.execute.call(ctx, 0)).rejects.toThrow('No deck');
	});

	it('Get fails on errors other than 404', async () => {
		const { ctx, requests } = context(deckParam, () => {
			throw httpError(403, 'FORBIDDEN', 'Missing scope');
		});
		await expect(shareLink.get.execute.call(ctx, 0)).rejects.toThrow('Missing scope');
		expect(requests).toHaveLength(1);
	});

	it('Delete removes the link', async () => {
		const { ctx, requests } = context(deckParam, () => undefined);
		const [item] = await shareLink.delete.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({
			method: 'DELETE',
			url: `${API}/decks/${DECK_ID}/share-link`,
		});
		expect(item.json).toEqual({ deck_id: DECK_ID, deleted: true });
	});

	it('stops before calling the API when no presentation is chosen', async () => {
		const { ctx, requests } = context({ presentation: { mode: 'list', value: '' } }, () => ({}));
		await expect(shareLink.create.execute.call(ctx, 0)).rejects.toThrow(
			"The 'Presentation' parameter is empty",
		);
		expect(requests).toHaveLength(0);
	});
});

describe('Access', () => {
	const grant = (role = 'VIEW') => ({
		id: GRANT_ID,
		deck_id: DECK_ID,
		subject_type: 'EMAIL',
		subject_user_id: null,
		subject_email: 'b@example.com',
		role,
		granted_by: 'u1',
		created_at: '2026-11-13T00:00:00Z',
		membership_status: null,
	});

	it('Grant posts the subject and role', async () => {
		const { ctx, requests } = context(
			{ ...deckParam, subject: ' b@example.com ', role: 'COMMENT' },
			() => grant('COMMENT'),
		);
		const [item] = await access.grant.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({
			method: 'POST',
			url: `${API}/decks/${DECK_ID}/grants`,
			body: { subject: 'b@example.com', role: 'COMMENT' },
		});
		expect(item.json).toMatchObject({ id: GRANT_ID, role: 'COMMENT' });
	});

	it('Grant defaults to View and accepts a lowercase role', async () => {
		const first = context({ ...deckParam, subject: 'u2' }, () => grant());
		await access.grant.execute.call(first.ctx, 0);
		expect(first.requests[0].body).toEqual({ subject: 'u2', role: 'VIEW' });

		const second = context({ ...deckParam, subject: 'u2', role: 'edit' }, () => grant('EDIT'));
		await access.grant.execute.call(second.ctx, 0);
		expect(second.requests[0].body).toEqual({ subject: 'u2', role: 'EDIT' });
	});

	it('Grant refuses an empty person or an unknown role', async () => {
		const empty = context({ ...deckParam, subject: ' ' }, () => ({}));
		await expect(access.grant.execute.call(empty.ctx, 0)).rejects.toThrow(
			"The 'Person' parameter is empty",
		);
		const badRole = context({ ...deckParam, subject: 'u2', role: 'OWNER' }, () => ({}));
		await expect(access.grant.execute.call(badRole.ctx, 0)).rejects.toThrow(
			"'Role' must be View, Comment or Edit, not 'OWNER'",
		);
		expect(empty.requests).toHaveLength(0);
		expect(badRole.requests).toHaveLength(0);
	});

	it('Get Many returns one item per grant from the bare array', async () => {
		const { ctx, requests } = context({ ...deckParam, returnAll: true }, () => [
			grant(),
			{ ...grant('EDIT'), id: 'g2' },
		]);
		const items = await access.getMany.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'GET', url: `${API}/decks/${DECK_ID}/grants` });
		expect(items.map((i) => i.json.id)).toEqual([GRANT_ID, 'g2']);
		expect(items.every((i) => (i.pairedItem as { item: number }).item === 0)).toBe(true);
	});

	it('Get Many applies the limit', async () => {
		const { ctx } = context({ ...deckParam, returnAll: false, limit: 1 }, () => [
			grant(),
			{ ...grant(), id: 'g2' },
		]);
		expect(await access.getMany.execute.call(ctx, 0)).toHaveLength(1);
	});

	it('Update patches the role', async () => {
		const { ctx, requests } = context({ ...deckParam, grantId: GRANT_ID, role: 'EDIT' }, () =>
			grant('EDIT'),
		);
		const [item] = await access.update.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({
			method: 'PATCH',
			url: `${API}/decks/${DECK_ID}/grants/${GRANT_ID}`,
			body: { role: 'EDIT' },
		});
		expect(item.json).toMatchObject({ role: 'EDIT' });
	});

	it('Update stops when the grant ID is empty', async () => {
		const { ctx } = context({ ...deckParam, grantId: '', role: 'EDIT' }, () => ({}));
		await expect(access.update.execute.call(ctx, 0)).rejects.toThrow(
			"The 'Grant ID' parameter is empty",
		);
	});

	it('Revoke deletes the grant', async () => {
		const { ctx, requests } = context({ ...deckParam, grantId: GRANT_ID }, () => undefined);
		const [item] = await access.revoke.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({
			method: 'DELETE',
			url: `${API}/decks/${DECK_ID}/grants/${GRANT_ID}`,
		});
		expect(item.json).toEqual({ deck_id: DECK_ID, grant_id: GRANT_ID, revoked: true });
	});
});

describe('Presentation → Delete', () => {
	it('deletes the presentation', async () => {
		const { ctx, requests } = context(
			{ presentation: `https://app.example.com/decks/${DECK_ID}` },
			() => undefined,
		);
		const [item] = await presentation.delete.execute.call(ctx, 0);
		expect(requests[0]).toMatchObject({ method: 'DELETE', url: `${API}/decks/${DECK_ID}` });
		expect(item.json).toEqual({ deck_id: DECK_ID, deleted: true });
	});
});

describe('router', () => {
	it('routes the new resources and adds no presentation hint for file status', async () => {
		const { ctx } = context({ resource: 'file', operation: 'get', fileId: 'f1' }, () => ({
			file_id: 'f1',
			filename: 'a.pdf',
			status: 'RUNNING',
			created_at: 'x',
		}));
		const [items] = await router.call(ctx);
		expect(items[0].json).toMatchObject({ file_id: 'f1', status: 'RUNNING' });
		expect(ctx.addExecutionHints).not.toHaveBeenCalled();
	});
});

describe('node description', () => {
	const { description } = new PresentationsAi();

	const operationsOf = (resource: string): INodePropertyOptions[] => {
		const operation = description.properties.find(
			(p: INodeProperties) =>
				p.name === 'operation' &&
				(p.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
		);
		return (operation?.options ?? []) as INodePropertyOptions[];
	};

	const shown = (resource: string, option: INodePropertyOptions, tool: boolean) =>
		NodeHelpers.displayParameter(
			{ resource, operation: option.value },
			option,
			{ typeVersion: 3 },
			{ name: tool ? 'presentationsAiTool' : 'presentationsAi' } as INodeTypeDescription,
		);

	const hiddenInTools: Record<string, string[]> = {
		access: ['grant', 'revoke', 'update'],
		account: [],
		brandKit: [],
		file: ['delete', 'upload'],
		presentation: ['createFromFile', 'delete', 'download', 'update'],
		project: [],
		shareLink: ['create', 'delete'],
	};

	it.each(Object.entries(hiddenInTools))(
		'%s hides exactly %j from AI Agent tools',
		(resource, expected) => {
			const options = operationsOf(resource);
			expect(options.length).toBeGreaterThan(0);
			const hidden = options.filter((o) => !shown(resource, o, true)).map((o) => o.value);
			expect(hidden.sort()).toEqual(expected);
			// Every operation is there in a normal workflow.
			expect(options.every((o) => shown(resource, o, false))).toBe(true);
		},
	);

	it('never offers Create Share Link or Download File to AI Agent tools', () => {
		for (const name of ['createShareLink', 'shareLinkNotice', 'downloadFile']) {
			const field = description.properties.find(
				(p) =>
					p.name === name &&
					(p.displayOptions?.show?.operation as string[] | undefined)?.includes('createFromTopic'),
			);
			expect(field).toBeDefined();
			const params = {
				resource: 'presentation',
				operation: 'createFromTopic',
				waitForCompletion: true,
				createShareLink: true,
			};
			const asTool = NodeHelpers.displayParameter(params, field!, { typeVersion: 3 }, {
				name: 'presentationsAiTool',
			} as INodeTypeDescription);
			const inWorkflow = NodeHelpers.displayParameter(params, field!, { typeVersion: 3 }, {
				name: 'presentationsAi',
			} as INodeTypeDescription);
			expect({ name, asTool, inWorkflow }).toEqual({ name, asTool: false, inWorkflow: true });
		}
	});

	it("doesn't claim what unsharing or Update does to visibility (it changes with the backend)", () => {
		const text = JSON.stringify(description).toLowerCase();
		for (const claim of [
			'can still open',
			'leaves it visible',
			"doesn't remove a share link",
			'still open the presentation',
			'anyone with the link can still',
		]) {
			expect({ claim, found: text.includes(claim) }).toEqual({ claim, found: false });
		}
	});

	it('defaults every resource to an operation AI Agent tools can use', () => {
		for (const resource of Object.keys(hiddenInTools)) {
			const operation = description.properties.find(
				(p) =>
					p.name === 'operation' &&
					(p.displayOptions?.show?.resource as string[] | undefined)?.includes(resource),
			);
			expect(hiddenInTools[resource]).not.toContain(operation?.default);
		}
	});

	it('lists resources and operations alphabetically, each with an action', () => {
		const resource = description.properties.find((p) => p.name === 'resource');
		const names = (resource?.options as INodePropertyOptions[]).map((o) => o.name);
		expect(names).toEqual([...names].sort());
		expect(names).toEqual([
			'Access',
			'Account',
			'Brand Kit',
			'File',
			'Job',
			'Outline',
			'Presentation',
			'Project',
			'Share Link',
		]);
		for (const value of (resource?.options as INodePropertyOptions[]).map((o) => o.value)) {
			const options = operationsOf(String(value));
			const optionNames = options.map((o) => o.name);
			expect(optionNames).toEqual([...optionNames].sort());
			expect(options.every((o) => typeof o.action === 'string' && o.action.length > 0)).toBe(true);
		}
	});

	it('has a handler for every new operation', async () => {
		const added: Array<[string, string[]]> = [
			...['access', 'account', 'brandKit', 'file', 'project', 'shareLink'].map(
				(r): [string, string[]] => [r, operationsOf(r).map((o) => String(o.value))],
			),
			['presentation', ['delete']],
		];
		for (const [r, operations] of added) {
			for (const op of operations) {
				const { ctx } = context({ resource: r, operation: op }, () => ({}));
				// Every handler exists, so no item fails with "not supported".
				await router.call(ctx).catch((error: Error) => {
					expect(error.message).not.toMatch(/is not supported/);
				});
			}
		}
	});
});
