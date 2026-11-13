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
	CreateDeckRequest,
	ExternalDeckExportResponse,
	ExternalFileResponse,
	GeneratedDeckResponse,
	ShareLink,
} from '../types';

export const CREDENTIAL_TYPE = 'presentationsAiApi';
const DEFAULT_BASE_URL = 'https://api.presentations.ai';
const API_PREFIX = '/api/v1';

// Upper bound the API accepts for `Prefer: wait=N`.
export const MAX_PREFER_WAIT_SECONDS = 180;
// The API docs ask callers to poll every 5 seconds.
const POLL_INTERVAL_MS = 5_000;

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

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_TYPE, {
			method,
			url: `${baseUrl}${API_PREFIX}${path}`,
			json: true,
			// List searches in the editor have no execution to cancel.
			abortSignal: 'getExecutionCancelSignal' in this ? this.getExecutionCancelSignal() : undefined,
			...options,
		});
	} catch (error) {
		throw toApiError(this.getNode(), error);
	}
}

// Puts the API's own message ("Insufficient credits", field errors) in front
// of n8n's generic status-code text. Re-wrapping a NodeApiError returns it
// unchanged, so a new error is built from the response body instead.
function toApiError(node: INode, error: unknown): NodeApiError {
	const body = getApiErrorBody(error);
	const httpCode = getHttpStatus(error);
	if (!body?.message) return new NodeApiError(node, error as JsonObject, { httpCode });

	const fieldErrors = (body.details?.errors as IDataObject[] | undefined)
		?.map((issue) => `${((issue.loc as string[]) ?? []).join('.')}: ${String(issue.msg)}`)
		.join('; ');
	// Keys from the previous Presentations.AI API were not carried over.
	const keyHint =
		body.code === 'UNAUTHENTICATED' || body.code === 'INVALID_TOKEN'
			? 'Create a new API key at https://api.presentations.ai/#/apikeys and update the Presentations.AI credential. Keys from the previous API no longer work'
			: undefined;
	const hint =
		keyHint ??
		(httpCode === '402'
			? "Your Presentations.AI workspace has no credits left. Add credits or upgrade, then run the node again. Only create operations use credits"
			: body.code === 'REQUEST_ID_CONFLICT'
				? "This Request ID was already used with different inputs. Leave 'Request ID' empty, or use one that is unique for each item"
				: body.code === 'FORBIDDEN'
					? "Your API key doesn't allow this. Create a key with the Deck automation preset at https://api.presentations.ai/#/apikeys. A key limited to one project can only create in that project"
					: undefined);
	const description = [
		hint,
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

// The project an API key is limited to, or undefined for a workspace-wide key.
// Such a key can only create presentations inside its own project.
export async function getKeyProjectId(this: IExecuteFunctions): Promise<string | undefined> {
	const me = (await apiRequest.call(this, 'GET', '/me')) as { project_id?: string | null };
	return me.project_id ?? undefined;
}

export async function createShareLink(this: IExecuteFunctions, deckId: string): Promise<ShareLink> {
	return (await apiRequest.call(
		this,
		'POST',
		`/decks/${encodeURIComponent(deckId)}/share-link`,
	)) as ShareLink;
}

// Polls until the task settles or the deadline passes. Stopping the workflow
// aborts the wait immediately.
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
