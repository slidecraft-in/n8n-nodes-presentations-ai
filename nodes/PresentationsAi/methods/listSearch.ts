import type {
	ILoadOptionsFunctions,
	INodeListSearchItems,
	INodeListSearchResult,
} from 'n8n-workflow';

import { apiRequest, listDecks } from '../transport';
import type { BrandKitMatch, Page, Project } from '../types';

const PAGE_SIZE = 50;

export async function searchBrandKits(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = Number(paginationToken) || 1;
	const qs: Record<string, string | number> = { page, limit: PAGE_SIZE };
	if (filter?.trim()) qs.q = filter.trim().slice(0, 100);
	const response = (await apiRequest.call(this, 'GET', '/brand-kits', {
		qs,
	})) as Page<BrandKitMatch>;
	return {
		results: response.data.map((kit) => ({
			name: kit.domain ? `${kit.name} (${kit.domain})` : kit.name,
			value: kit.id,
		})),
		paginationToken: page * PAGE_SIZE < response.total ? String(page + 1) : undefined,
	};
}

export async function searchPresentations(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = Number(paginationToken) || 1;
	const qs: Record<string, string | number> = { page, limit: PAGE_SIZE, sort: 'RECENT' };
	if (filter?.trim()) qs.search = filter.trim().slice(0, 200);
	const response = await listDecks.call(this, qs);
	return {
		results: response.data.map((deck) => ({
			name: deck.name || deck.id,
			value: deck.id,
			url: deck.deck_url ?? undefined,
		})),
		paginationToken: page * PAGE_SIZE < response.total ? String(page + 1) : undefined,
	};
}

const PROJECT_PAGE_SIZE = 200;
const MAX_PROJECT_PAGES_PER_SEARCH = 10;

// The API has no name search for projects, so pages are filtered here. With a
// search term, further pages are read until something matches or none are left.
export async function searchProjects(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const needle = filter?.trim().toLowerCase() ?? '';
	let page = Number(paginationToken) || 1;
	const results: INodeListSearchItems[] = [];
	for (let read = 0; read < MAX_PROJECT_PAGES_PER_SEARCH; read++) {
		const response = (await apiRequest.call(this, 'GET', '/projects', {
			qs: { kind: 'PROJECT', page, limit: PROJECT_PAGE_SIZE },
		})) as Page<Project>;
		for (const project of response.data) {
			if (project.archived_at) continue;
			if (needle && !project.name.toLowerCase().includes(needle)) continue;
			results.push({ name: project.name, value: project.id });
		}
		if (page * PROJECT_PAGE_SIZE >= response.total) return { results };
		page++;
		if (!needle || results.length > 0) break;
	}
	return { results, paginationToken: String(page) };
}
