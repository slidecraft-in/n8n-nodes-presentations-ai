import { createHash, randomUUID } from 'crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:~-]{0,254}$/;

export function isValidRequestId(value: string): boolean {
	return REQUEST_ID_PATTERN.test(value);
}

// One ID per node run and item. n8n keeps the run index across Retry On Fail
// attempts, so a retry replays the original request instead of creating a
// second deck, while each pass of a loop gets a new run index and a new deck.
// The instance and workflow IDs keep IDs apart when several n8n instances
// share an API key or a workflow is imported elsewhere with the same node IDs.
export function buildRequestId(parts: {
	instanceId?: string;
	workflowId?: string;
	executionId?: string;
	nodeId: string;
	runIndex: number;
	itemIndex: number;
}): string {
	// Without an execution ID there is nothing stable to retry against.
	const executionId = parts.executionId?.trim() || randomUUID();
	const key = [
		parts.instanceId ?? '',
		parts.workflowId ?? '',
		executionId,
		parts.nodeId,
		String(parts.runIndex),
		String(parts.itemIndex),
	].join('|');
	return `n8n-${createHash('sha256').update(key).digest('hex').slice(0, 40)}`;
}

// JSON with object keys sorted, so the same inputs always give the same text.
export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (value && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
}

// Version 3: one ID per API key and request content, the way Presentations.AI's
// MCP server derives it. Running the node again with the same inputs, from any
// execution, replays the presentation already made instead of paying again.
// Request IDs are unique per workspace, so the key keeps two people's
// identical requests apart. Attempt 2 and later get a suffix (see deck.ts).
export function deriveRequestId(credentialKey: string, request: unknown, attempt = 1): string {
	const digest = createHash('sha256')
		.update(
			`${createHash('sha256').update(credentialKey).digest('hex')}\n${canonicalJson(request)}`,
		)
		.digest('hex')
		.slice(0, 40);
	return attempt <= 1 ? `n8n3-${digest}` : `n8n3-${digest}-${attempt}`;
}
