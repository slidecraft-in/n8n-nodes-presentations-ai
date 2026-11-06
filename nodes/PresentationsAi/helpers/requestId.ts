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
