import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

// Matched by name too: in development the node can load its own copy of
// n8n-workflow, where instanceof checks against n8n's errors fail.
export function isNodeError(error: unknown): error is NodeApiError | NodeOperationError {
	return (
		error instanceof NodeApiError ||
		error instanceof NodeOperationError ||
		(error instanceof Error &&
			(error.name === 'NodeApiError' || error.name === 'NodeOperationError') &&
			'context' in error)
	);
}

export function toNodeError(
	this: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): NodeApiError | NodeOperationError {
	if (isNodeError(error)) {
		error.context.itemIndex = itemIndex;
		return error;
	}
	return new NodeOperationError(this.getNode(), error as Error, { itemIndex });
}

// Once a deck is requested, any later failure (waiting, downloading, sharing)
// names the request so Get Status can pick it up.
export function withRequestId(
	this: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	requestId: string,
): NodeApiError | NodeOperationError {
	const nodeError = toNodeError.call(this, error, itemIndex);
	const hint = `Request ID: ${requestId}`;
	if (!nodeError.description?.includes(requestId)) {
		nodeError.description = [
			nodeError.description,
			`${hint}. Use 'Get Status' with this ID to pick up the presentation.`,
		]
			.filter(Boolean)
			.join(' ');
	}
	return nodeError;
}
