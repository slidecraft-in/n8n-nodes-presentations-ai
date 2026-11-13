import type { IDataObject } from 'n8n-workflow';

import type {
	ApiErrorBody,
	Deck,
	DeckDetail,
	DeckExportFormat,
	GeneratedDeckResponse,
	ShareLink,
} from '../types';

const EXTENSION_BY_FORMAT: Record<DeckExportFormat, string> = {
	PPTX: 'pptx',
	PDF: 'pdf',
	// IMAGE exports are a ZIP with one image per slide.
	IMAGE: 'zip',
};

// Expressions can resolve to numbers, null or undefined; parameters that hold
// text are read through this.
export function toText(value: unknown): string {
	return value === undefined || value === null ? '' : String(value);
}

// Resource locator values arrive as { mode, value }; expressions may give a
// plain string instead.
export function locatorValue(value: unknown): string {
	if (typeof value === 'object' && value !== null) {
		return 'value' in value ? toText((value as { value: unknown }).value).trim() : '';
	}
	return toText(value).trim();
}

// Accepts a bare request ID or a URL ending in it: the status_url from a
// create response, or a pollUrl saved by an earlier version of this node.
export function extractRequestId(input: string): string | undefined {
	const trimmed = input.trim();
	if (!trimmed) return undefined;
	if (!/^https?:\/\//i.test(trimmed)) return trimmed;
	const path = trimmed.replace(/^https?:\/\/[^/?#]*/i, '').split(/[?#]/)[0];
	const last = path.split('/').filter(Boolean).pop();
	if (!last) return undefined;
	try {
		return decodeURIComponent(last);
	} catch {
		return last;
	}
}

const MAX_FILE_NAME_LENGTH = 120;

// Shortened names keep their extension.
export function sanitizeFileName(name: string): string {
	const printable = Array.from(name, (char) => (char.charCodeAt(0) < 32 ? ' ' : char)).join('');
	const clean = printable
		.replace(/[\\/:*?"<>|]+/g, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/^\.+/, '')
		.trim();
	if (clean.length <= MAX_FILE_NAME_LENGTH) return clean;
	const extension = /\.[A-Za-z0-9]{1,8}$/.exec(clean)?.[0] ?? '';
	return `${clean.slice(0, MAX_FILE_NAME_LENGTH - extension.length).trim()}${extension}`;
}

function fileNameFromContentDisposition(header: string | undefined): string | undefined {
	if (!header) return undefined;
	const encoded = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
	if (encoded) {
		try {
			return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ''));
		} catch {
			// Fall through to the plain filename parameter.
		}
	}
	const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
	return plain?.[1]?.trim();
}

// Prefers the server's filename, then the requested deck title, then the deck ID.
export function buildExportFileName(options: {
	format: DeckExportFormat;
	deckId: string;
	contentDisposition?: string;
	title?: string;
}): string {
	const extension = EXTENSION_BY_FORMAT[options.format] ?? 'bin';
	const fromServer = sanitizeFileName(
		fileNameFromContentDisposition(options.contentDisposition) ?? '',
	);
	if (fromServer) return fromServer;
	const base = sanitizeFileName(options.title ?? '') || `presentation-${options.deckId}`;
	return base.toLowerCase().endsWith(`.${extension}`) ? base : `${base}.${extension}`;
}

type ErrorLike = {
	httpCode?: unknown;
	context?: { data?: unknown; retryAfterMs?: unknown };
	response?: { status?: unknown; data?: unknown; headers?: Record<string, unknown> };
	cause?: unknown;
};

// A failed request can arrive wrapped one or more times (NodeApiError around
// the HTTP client error), so the cause chain is searched.
function* errorChain(error: unknown): Generator<ErrorLike> {
	let current = error;
	for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth++) {
		yield current as ErrorLike;
		current = (current as ErrorLike).cause;
	}
}

// Reads the API's error envelope ({ error: { code, message, trace_id } }) from
// whatever n8n attached to a failed request.
// Error bodies of binary downloads arrive as bytes.
function decodeBody(data: unknown): unknown {
	if (!(data instanceof Uint8Array || data instanceof ArrayBuffer)) return data;
	try {
		return JSON.parse(Buffer.from(data as Uint8Array).toString('utf8')) as unknown;
	} catch {
		return undefined;
	}
}

export function getApiErrorBody(error: unknown): ApiErrorBody['error'] | undefined {
	for (const link of errorChain(error)) {
		for (const raw of [link.context?.data, link.response?.data]) {
			const data = decodeBody(raw);
			if (typeof data === 'object' && data !== null && 'error' in data) {
				const body = (data as ApiErrorBody).error;
				if (typeof body === 'object' && body !== null) return body;
			}
		}
	}
	return undefined;
}

// HTTP status of a failed request, read from an n8n NodeApiError (httpCode) or
// the underlying HTTP client error.
export function getHttpStatus(error: unknown): string | undefined {
	for (const link of errorChain(error)) {
		const status = link.httpCode ?? link.response?.status;
		if (status !== undefined && status !== null) return String(status);
	}
	return undefined;
}

// The ten most-used fields, flattened and most used first. n8n's UX guidelines
// ask for a "Simplify" option when a response has more than ten fields.
export function simplifyDeckResponse(
	response: GeneratedDeckResponse,
	shareLink?: ShareLink,
): IDataObject {
	return {
		status: response.status,
		request_id: response.request_id,
		deck_id: response.deck_id,
		deck_url: response.deck_url,
		share_url: shareLink?.url ?? null,
		export_format: response.export?.format ?? null,
		file_size_bytes: response.export?.size_bytes ?? null,
		stage: response.stage,
		status_url: response.status_url,
		error: response.error,
	};
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// A presentation picker gives an ID, or a URL with the ID in its path (the
// deck_url, or the address of the presentation in the browser). The last ID in
// the path is the presentation's.
export function deckIdFrom(value: unknown): string {
	const text = locatorValue(value);
	if (!/^https?:\/\//i.test(text)) return text;
	const path = text.replace(/^https?:\/\/[^/?#]*/i, '').split(/[?#]/)[0];
	return path.match(UUID)?.pop() ?? '';
}

// Ten fields of a presentation, for Get, Get Many and Update. The API returns
// more than ten, so n8n's UX guidelines ask for this behind "Simplify".
export function simplifyDeck(deck: Deck | DeckDetail): IDataObject {
	const detail = deck as Partial<DeckDetail>;
	return {
		id: deck.id,
		name: deck.name,
		...(detail.status ? { status: detail.status } : {}),
		visibility: deck.visibility,
		project_id: deck.project_id ?? null,
		deck_url: deck.deck_url ?? null,
		has_share_link: deck.has_share_link ?? false,
		...(detail.exports ? { export_formats: detail.exports.map((e) => e.format) } : {}),
		created_at: deck.created_at,
		updated_at: deck.updated_at,
		...(detail.exports ? {} : { starred: (deck.flags ?? []).includes('STARRED') }),
	};
}

// Retry-After is either seconds or an HTTP date.
export function parseRetryAfterMs(value: unknown, now = Date.now()): number | undefined {
	const text = toText(Array.isArray(value) ? value[0] : value).trim();
	if (!text) return undefined;
	if (/^\d+$/.test(text)) return Number(text) * 1000;
	const date = Date.parse(text);
	return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

// How long the API asked the caller to wait (429 and 503 send Retry-After).
export function getRetryAfterMs(error: unknown): number | undefined {
	for (const link of errorChain(error)) {
		if (typeof link.context?.retryAfterMs === 'number') return link.context.retryAfterMs;
		const header = parseRetryAfterMs(link.response?.headers?.['retry-after']);
		if (header !== undefined) return header;
	}
	return undefined;
}
