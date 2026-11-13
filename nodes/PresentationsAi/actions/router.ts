import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { toNodeError } from './errors';
import * as job from './job';
import * as presentation from './presentation';

type OperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

const handlers: Record<string, Record<string, OperationHandler>> = {
	presentation: {
		createFromContent: presentation.createFromContent.execute,
		createFromFile: presentation.createFromFile.execute,
		createFromTopic: presentation.createFromTopic.execute,
		createSingleSlide: presentation.createSingleSlide.execute,
	},
	job: {
		checkStatus: job.checkStatus.execute,
	},
};

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const resource = this.getNodeParameter('resource', 0) as string;
	const operation = this.getNodeParameter('operation', 0) as string;
	const handler = handlers[resource]?.[operation];
	if (!handler) {
		throw new NodeOperationError(
			this.getNode(),
			`The operation "${operation}" is not supported for resource "${resource}"`,
		);
	}

	const returnData: INodeExecutionData[] = [];
	for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
		try {
			returnData.push(...(await handler.call(this, itemIndex)));
		} catch (error) {
			const nodeError = toNodeError.call(this, error, itemIndex);
			if (this.continueOnFail() && !this.getExecutionCancelSignal()?.aborted) {
				// The item-level `error` is what sends an item to the error output under
				// "Continue (using error output)" on every n8n version; n8n 2.33 and
				// earlier don't recognise `{ error, details }` JSON on its own.
				returnData.push({
					json: {
						error: nodeError.message,
						...(nodeError.description ? { details: nodeError.description } : {}),
					},
					error: nodeError,
					pairedItem: { item: itemIndex },
				});
				continue;
			}
			throw nodeError;
		}
	}
	addNotReadyHint.call(this, operation, returnData);
	return [returnData];
}

// Shown in the output panel when presentations were requested but aren't
// finished, so the next step (Get Status) is obvious.
function addNotReadyHint(
	this: IExecuteFunctions,
	operation: string,
	returnData: INodeExecutionData[],
): void {
	const notReady = returnData.filter(
		(item) => item.json.status === 'CREATED' || item.json.status === 'RUNNING',
	).length;
	if (notReady === 0) return;
	const one = notReady === 1;
	const subject = one ? "1 presentation isn't" : `${notReady} presentations aren't`;
	this.addExecutionHints({
		message:
			operation === 'checkStatus'
				? `${subject} ready yet. Run 'Get Status' again later.`
				: `${subject} ready yet. Use the 'Get Status' operation with the 'request_id' to check on ${one ? 'it and download the file' : 'them and download the files'}.`,
		location: 'outputPane',
	});
}
