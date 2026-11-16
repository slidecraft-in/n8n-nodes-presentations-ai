import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IN8nHttpFullResponse,
	INode,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, sleep } from 'n8n-workflow';

import {
	buildExportFileName,
	getApiErrorBody,
	getHttpStatus,
	getRetryAfterMs,
} from '../helpers/utils';
import type {
	AsyncTaskStatus,
	BrandKit,
	CreateDeckRequest,
	Credits,
	Deck,
	DeckDetail,
	DeckSource,
	ExternalDeckExportResponse,
	ExternalFileResponse,
	GeneratedDeckResponse,
	Grant,
	GrantRole,
	Me,
	Page,
	ProjectDetail,
	ShareLink,
} from '../types';

export const CREDENTIAL_TYPE = 'presentationsAiApi';
const DEFAULT_BASE_URL = 'https://api.presentations.ai';
const API_PREFIX = '/api/v1';

// Upper bound the API accepts for `Prefer: wait=N`.
export const MAX_PREFER_WAIT_SECONDS = 180;
// The API docs ask callers to poll every 5 seconds.
const POLL_INTERVAL_MS = 5_000;
// Up to two more tries after a 429 or a retryable 5xx, waiting what the API
// asks for (Retry-After) or 2 s, then 4 s, never more than 30 s at a time.
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2_000;
const MAX_RETRY_WAIT_MS = 30_000;

type RequestOptions = Omit<IHttpRequestOptions, 'url' | 'method'>;

function isRetryable(error: unknown): boolean {
	const status = Number(getHttpStatus(error));
	return status === 429 || status >= 500;
}

export function isSettled(status: AsyncTaskStatus | null | undefined): boolean {
	return status === 'COMPLETED' || status === 'FAILED';
}

// Accepts the host with or without a trailing slash or /api/v1, and falls back
// to production when the field is empty.
export function normalizeBaseUrl(value: unknown): string {
	const text = typeof value === 'string' ? value.trim() : '';
	return (text || DEFAULT_BASE_URL).replace(/\/+$/, '').replace(/\/api\/v1$/i, '');
}

type RequestContext = IExecuteFunctions | ILoadOptionsFunctions;

export async function apiRequest(
	this: RequestContext,
	method: IHttpRequestMethods,
	path: string,
	options: RequestOptions = {},
): Promise<unknown> {
	const credentials = await this.getCredentials(CREDENTIAL_TYPE);
	const baseUrl = normalizeBaseUrl(credentials.baseUrl);

	// List searches in the editor have no execution to cancel.
	const signal = 'getExecutionCancelSignal' in this ? this.getExecutionCancelSignal() : undefined;
	for (let attempt = 1; ; attempt++) {
		try {
			return await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_TYPE, {
				method,
				url: `${baseUrl}${API_PREFIX}${path}`,
				json: true,
				abortSignal: signal,
				...options,
			});
		} catch (error) {
			if (attempt >= MAX_ATTEMPTS || !canRetry(method, path, error) || signal?.aborted) {
				throw toApiError(this.getNode(), error);
			}
			const waitMs = Math.min(
				getRetryAfterMs(error) ?? RETRY_BACKOFF_MS * attempt,
				MAX_RETRY_WAIT_MS,
			);
			await sleep(waitMs, signal);
			signal?.throwIfAborted();
		}
	}
}

// A rate-limited request (429) was refused before any work, so it is always
// sent again. After a server error (5xx) only requests that can't do anything
// twice are: reads, deletes, and creating a presentation, where the same
// Request-Id replays the first attempt instead of charging again.
function canRetry(method: IHttpRequestMethods, path: string, error: unknown): boolean {
	const status = Number(getHttpStatus(error));
	if (status === 429) return true;
	if (!(status >= 500)) return false;
	return method === 'GET' || method === 'DELETE' || (method === 'POST' && path === '/decks');
}

// Puts the API's own message ("Insufficient credits", field errors) in front
// of n8n's generic status-code text. Re-wrapping a NodeApiError returns it
// unchanged, so a new error is built from the response body instead.
// What to do next for API error codes, by code. 402 (no credits) is matched by
// HTTP status above.
const CODE_HINTS: Record<string, string> = {
	REQUEST_ID_CONFLICT:
		"This Request ID was already used with different inputs. Leave 'Request ID' empty, or use one that is unique for each item",
	FORBIDDEN:
		"Your API key doesn't allow this. Create a key with the Deck automation preset at https://api.presentations.ai/#/apikeys. A key limited to one project can only create in that project",
	FEATURE_NOT_IN_PLAN:
		"Your Presentations.AI plan doesn't include an option you chose, such as a higher 'Model' tier or 'Deep Research'. Remove it, or upgrade the plan",
	PLAN_LIMIT_EXCEEDED:
		'This goes over a limit of your Presentations.AI plan. Make the request smaller, or upgrade the plan',
	CONTENT_TOO_LONG:
		'The text is longer than Presentations.AI accepts. Shorten it, or split it across more than one presentation',
	SOURCES_NOT_READY: 'A file is still being read. Run the node again in a minute',
	SOURCE_FAILED:
		"Presentations.AI couldn't read a file used as a source. Check that it opens and is a supported type, such as PDF, Word, PowerPoint, Excel or text",
	RATE_LIMITED:
		'Presentations.AI allows 200 requests a minute per API key, and the node already waited and tried again. Slow the workflow down, for example with smaller batches or a Wait node',
};

// A suspended workspace is refused at sign-in (401), can't spend credits
// (403 WORKSPACE_SUSPENDED), and a deck that is already running fails with
// this text. A new API key doesn't help.
export const SUSPENDED_HINT =
	"Your Presentations.AI workspace is suspended, so a new API key won't help. Check billing in Presentations.AI, or ask the workspace owner";

export function mentionsSuspension(text: unknown): boolean {
	return typeof text === 'string' && /suspend/i.test(text);
}

// Scopes listed in a 403's details, when the API sends them.
function missingScopes(details: IDataObject | null | undefined): string | undefined {
	if (!details) return undefined;
	for (const key of ['required_scopes', 'missing_scopes', 'scopes']) {
		const value = details[key];
		if (Array.isArray(value) && value.length) return value.map(String).join(', ');
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return undefined;
}

function toApiError(node: INode, error: unknown): NodeApiError {
	const body = getApiErrorBody(error);
	const httpCode = getHttpStatus(error);
	if (!body?.message) return new NodeApiError(node, error as JsonObject, { httpCode });

	const fieldErrors = (body.details?.errors as IDataObject[] | undefined)
		?.map((issue) => `${((issue.loc as string[]) ?? []).join('.')}: ${String(issue.msg)}`)
		.join('; ');
	// Keys from the previous Presentations.AI API were not carried over.
	const unauthenticated =
		httpCode === '401' || body.code === 'UNAUTHENTICATED' || body.code === 'INVALID_TOKEN';
	const keyHint = !unauthenticated
		? undefined
		: mentionsSuspension(body.message)
			? SUSPENDED_HINT
			: 'Create a new API key at https://api.presentations.ai/#/apikeys and update the Presentations.AI credential. Keys from the previous API no longer work';
	const hint =
		keyHint ??
		(httpCode === '402'
			? "You're out of credits. Top up in Presentations.AI, then try again. Only creating presentations and outlines uses credits"
			: body.code === 'WORKSPACE_SUSPENDED'
				? SUSPENDED_HINT
				: (body.code && CODE_HINTS[body.code]) || undefined);
	const scopes = missingScopes(body.details);
	const description = [
		hint,
		scopes && `Scopes the API key needs: ${scopes}`,
		fieldErrors,
		body.code && `Code: ${body.code}`,
		body.trace_id && `Trace ID: ${body.trace_id}`,
	]
		.filter(Boolean)
		.join('. ');
	// The body is keyed so n8n doesn't read the API's error code as an HTTP status.
	const apiError = new NodeApiError(
		node,
		{ message: body.message, api_error: body } as JsonObject,
		{ message: body.message, description, httpCode },
	);
	// Same place n8n keeps a response body, so callers can branch on error.code.
	apiError.context.data = { error: body } as IDataObject;
	const retryAfterMs = getRetryAfterMs(error);
	if (retryAfterMs !== undefined) apiError.context.retryAfterMs = retryAfterMs;
	return apiError;
}

export async function createDeck(
	this: IExecuteFunctions,
	requestId: string,
	body: CreateDeckRequest,
	waitSeconds: number,
): Promise<GeneratedDeckResponse> {
	const headers: IDataObject = { 'Request-Id': requestId };
	const wait = Math.min(Math.floor(waitSeconds), MAX_PREFER_WAIT_SECONDS);
	if (wait > 0) headers.Prefer = `wait=${wait}`;
	return (await apiRequest.call(this, 'POST', '/decks', {
		headers,
		body,
	})) as GeneratedDeckResponse;
}

export async function getGenerationRequest(
	this: IExecuteFunctions,
	requestId: string,
): Promise<GeneratedDeckResponse> {
	return (await apiRequest.call(
		this,
		'GET',
		`/requests/${encodeURIComponent(requestId)}`,
	)) as GeneratedDeckResponse;
}

export async function uploadFile(
	this: IExecuteFunctions,
	data: Buffer,
	fileName: string,
	mimeType: string,
): Promise<ExternalFileResponse> {
	// Native FormData: n8n's HTTP client streams it as multipart/form-data
	// with its own boundary, and no runtime dependency is needed.
	const form = new FormData();
	form.append('file', new Blob([new Uint8Array(data)], { type: mimeType }), fileName);
	return (await apiRequest.call(this, 'POST', '/files', { body: form })) as ExternalFileResponse;
}

export async function getFile(
	this: IExecuteFunctions,
	fileId: string,
): Promise<ExternalFileResponse> {
	return (await apiRequest.call(
		this,
		'GET',
		`/files/${encodeURIComponent(fileId)}`,
	)) as ExternalFileResponse;
}

// Makes the deck public. The existing link is reused unless `rotate` is set,
// which makes a new one; the previous link then stops working.
export async function createShareLink(
	this: IExecuteFunctions,
	deckId: string,
	rotate = false,
): Promise<ShareLink> {
	return (await apiRequest.call(
		this,
		'POST',
		`/decks/${encodeURIComponent(deckId)}/share-link`,
		rotate ? { qs: { rotate: true } } : {},
	)) as ShareLink;
}

// Polls until the task settles or the deadline passes. Stopping the workflow
// aborts the wait immediately.
export type CreateOutlineBody = {
	prompt?: string;
	sources?: DeckSource[];
	language?: string;
	slide_count?: string;
	level_of_detail?: string;
};

// POST /outlines bills the outline's slides once and persists nothing. The
// Request-Id makes a retry safe: an ID that already paid gets 409.
export async function createOutline(
	this: IExecuteFunctions,
	requestId: string,
	body: CreateOutlineBody,
): Promise<IDataObject> {
	return (await apiRequest.call(this, 'POST', '/outlines', {
		headers: { 'Request-Id': requestId },
		body,
	})) as IDataObject;
}

export async function getDeck(this: RequestContext, deckId: string): Promise<DeckDetail> {
	return (await apiRequest.call(this, 'GET', `/decks/${encodeURIComponent(deckId)}`)) as DeckDetail;
}

export async function listDecks(
	this: RequestContext,
	qs: Record<string, string | number>,
): Promise<Page<Deck>> {
	return (await apiRequest.call(this, 'GET', '/decks', { qs })) as Page<Deck>;
}

export async function updateDeck(
	this: IExecuteFunctions,
	deckId: string,
	body: IDataObject,
): Promise<Deck> {
	return (await apiRequest.call(this, 'PATCH', `/decks/${encodeURIComponent(deckId)}`, {
		body,
	})) as Deck;
}

export async function listExports(
	this: IExecuteFunctions,
	deckId: string,
): Promise<ExternalDeckExportResponse[]> {
	const page = (await apiRequest.call(this, 'GET', `/decks/${encodeURIComponent(deckId)}/exports`, {
		qs: { page: 1, limit: 200 },
	})) as Page<ExternalDeckExportResponse>;
	return page.data;
}

export async function getDeckOutline(
	this: IExecuteFunctions,
	deckId: string,
): Promise<IDataObject> {
	return (await apiRequest.call(
		this,
		'GET',
		`/decks/${encodeURIComponent(deckId)}/outline`,
	)) as IDataObject;
}

async function pollUntilSettled<T extends { status: AsyncTaskStatus | null }>(
	context: IExecuteFunctions,
	current: T,
	fetchLatest: () => Promise<T>,
	deadline: number,
): Promise<T> {
	const signal = context.getExecutionCancelSignal();
	let latest = current;
	let delay = POLL_INTERVAL_MS;
	while (!isSettled(latest.status)) {
		const remaining = deadline - Date.now();
		if (remaining <= 0) break;
		// n8n 2.34 replaced sleepWithAbort with sleep(ms, signal), which stops at
		// once. Older n8n's sleep ignores the signal, so check it after each wait.
		await sleep(Math.min(delay, remaining), signal);
		signal?.throwIfAborted();
		delay = POLL_INTERVAL_MS;
		try {
			latest = await fetchLatest();
		} catch (error) {
			// Status reads are safe to repeat: wait out rate limits and outages
			// (429, 5xx) until the deadline, as the API docs advise.
			if (!isRetryable(error) || Date.now() >= deadline) {
				throw new NodeApiError(context.getNode(), error as JsonObject);
			}
			delay = getRetryAfterMs(error) ?? POLL_INTERVAL_MS;
		}
	}
	return latest;
}

export async function waitForRequest(
	this: IExecuteFunctions,
	current: GeneratedDeckResponse,
	deadline: number,
): Promise<GeneratedDeckResponse> {
	return await pollUntilSettled(
		this,
		current,
		async () => await getGenerationRequest.call(this, current.request_id),
		deadline,
	);
}

export async function waitForFile(
	this: IExecuteFunctions,
	current: ExternalFileResponse,
	deadline: number,
): Promise<ExternalFileResponse> {
	return await pollUntilSettled(
		this,
		current,
		async () => await getFile.call(this, current.file_id),
		deadline,
	);
}

function headerValue(value: unknown): string | undefined {
	if (Array.isArray(value)) return headerValue(value[0]);
	return typeof value === 'string' && value ? value : undefined;
}

// Downloads the finished file with the same API key; export.download_url is
// not a public link.
export async function downloadExport(
	this: IExecuteFunctions,
	exportInfo: ExternalDeckExportResponse,
	title?: string,
): Promise<IBinaryData> {
	const path = `/decks/${encodeURIComponent(exportInfo.deck_id)}/exports/${encodeURIComponent(exportInfo.id)}/content`;
	const response = (await apiRequest.call(this, 'GET', path, {
		encoding: 'arraybuffer',
		json: false,
		returnFullResponse: true,
	})) as IN8nHttpFullResponse;

	const data = Buffer.from(response.body as ArrayBuffer);
	const mimeType =
		headerValue(response.headers['content-type'])?.split(';')[0].trim() || exportInfo.content_type;
	const fileName = buildExportFileName({
		format: exportInfo.format,
		deckId: exportInfo.deck_id,
		contentDisposition: headerValue(response.headers['content-disposition']),
		title,
	});

	return await this.helpers.prepareBinaryData(data, fileName, mimeType);
}

export async function getMe(this: RequestContext): Promise<Me> {
	return (await apiRequest.call(this, 'GET', '/me')) as Me;
}

export async function getCredits(this: RequestContext): Promise<Credits> {
	return (await apiRequest.call(this, 'GET', '/credits')) as Credits;
}

export async function listProjects(
	this: RequestContext,
	qs: Record<string, string | number>,
): Promise<Page<ProjectDetail>> {
	return (await apiRequest.call(this, 'GET', '/projects', { qs })) as Page<ProjectDetail>;
}

export async function getProject(this: RequestContext, projectId: string): Promise<ProjectDetail> {
	return (await apiRequest.call(
		this,
		'GET',
		`/projects/${encodeURIComponent(projectId)}`,
	)) as ProjectDetail;
}

export async function listBrandKits(
	this: RequestContext,
	qs: Record<string, string | number>,
): Promise<Page<BrandKit>> {
	return (await apiRequest.call(this, 'GET', '/brand-kits', { qs })) as Page<BrandKit>;
}

export async function getBrandKit(this: RequestContext, brandKitId: string): Promise<BrandKit> {
	return (await apiRequest.call(
		this,
		'GET',
		`/brand-kits/${encodeURIComponent(brandKitId)}`,
	)) as BrandKit;
}

// 204 with no body.
export async function deleteFile(this: IExecuteFunctions, fileId: string): Promise<void> {
	await apiRequest.call(this, 'DELETE', `/files/${encodeURIComponent(fileId)}`);
}

// 404 when link sharing is off for the presentation.
export async function getShareLink(this: IExecuteFunctions, deckId: string): Promise<ShareLink> {
	return (await apiRequest.call(
		this,
		'GET',
		`/decks/${encodeURIComponent(deckId)}/share-link`,
	)) as ShareLink;
}

// 204. The presentation goes from public to workspace, not back to private.
export async function deleteShareLink(this: IExecuteFunctions, deckId: string): Promise<void> {
	await apiRequest.call(this, 'DELETE', `/decks/${encodeURIComponent(deckId)}/share-link`);
}

export async function listGrants(this: IExecuteFunctions, deckId: string): Promise<Grant[]> {
	const response = await apiRequest.call(
		this,
		'GET',
		`/decks/${encodeURIComponent(deckId)}/grants`,
	);
	return Array.isArray(response) ? (response as Grant[]) : [];
}

// Granting the same person again replaces their role.
export async function createGrant(
	this: IExecuteFunctions,
	deckId: string,
	body: { subject: string; role: GrantRole },
): Promise<Grant> {
	return (await apiRequest.call(this, 'POST', `/decks/${encodeURIComponent(deckId)}/grants`, {
		body,
	})) as Grant;
}

export async function updateGrant(
	this: IExecuteFunctions,
	deckId: string,
	grantId: string,
	body: { role: GrantRole },
): Promise<Grant> {
	return (await apiRequest.call(
		this,
		'PATCH',
		`/decks/${encodeURIComponent(deckId)}/grants/${encodeURIComponent(grantId)}`,
		{ body },
	)) as Grant;
}

export async function deleteGrant(
	this: IExecuteFunctions,
	deckId: string,
	grantId: string,
): Promise<void> {
	await apiRequest.call(
		this,
		'DELETE',
		`/decks/${encodeURIComponent(deckId)}/grants/${encodeURIComponent(grantId)}`,
	);
}

// 204. A soft delete; deleting again is not an error.
export async function deleteDeck(this: IExecuteFunctions, deckId: string): Promise<void> {
	await apiRequest.call(this, 'DELETE', `/decks/${encodeURIComponent(deckId)}`);
}
