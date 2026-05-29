import type {
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';

const CREDENTIAL_NAME = 'presentationsAiApi';
const DEFAULT_BASE_URL = 'https://api.presentations.ai';

// Build absolute URL from the user-configured baseUrl in credentials and call
// httpRequestWithAuthentication. Required because n8n's `requestDefaults.baseURL`
// from the node description only applies to declarative routing — not to direct
// calls from customOperations.
export async function presentationsAiRequest(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: unknown,
	extra?: Partial<IHttpRequestOptions>,
): Promise<unknown> {
	const credentials = await this.getCredentials(CREDENTIAL_NAME);
	const baseUrl = ((credentials.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${path}`,
		json: true,
		...extra,
	};
	if (body !== undefined) options.body = body;

	return this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL_NAME, options);
}

// Presentations.AI REST errors are returned as plain text or as JSON
// { error: string } depending on the endpoint. n8n's NodeApiError canned
// messages for 4xx/5xx hide the body. This helper extracts the specific
// message so custom operations can surface it.
export function extractApiErrorMessage(error: unknown): string | undefined {
	if (typeof error !== 'object' || error === null) return undefined;
	const err = error as {
		response?: { body?: unknown };
		cause?: unknown;
		description?: string;
		message?: string;
	};

	const candidates: unknown[] = [];
	const raw = err.response?.body;
	if (typeof raw === 'string') {
		try {
			candidates.push(JSON.parse(raw));
		} catch {
			// not JSON — keep the raw string as a fallback below
			if (raw.trim().length > 0) return raw.trim();
		}
	} else if (raw && typeof raw === 'object') {
		candidates.push(raw);
	}
	if (err.cause && typeof err.cause === 'object') {
		candidates.push(err.cause);
	}

	for (const c of candidates) {
		if (typeof c !== 'object' || c === null) continue;
		const obj = c as { error?: string | { message?: string }; message?: string };
		if (typeof obj.error === 'string') return obj.error;
		if (obj.error && typeof obj.error === 'object' && obj.error.message) {
			return obj.error.message;
		}
		if (typeof obj.message === 'string') return obj.message;
	}
	return err.description ?? err.message;
}
