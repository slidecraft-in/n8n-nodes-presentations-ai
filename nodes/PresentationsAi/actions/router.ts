import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import * as access from './access';
import * as account from './account';
import * as brandKit from './brandKit';
import { toNodeError } from './errors';
import * as file from './file';
import * as job from './job';
import * as outline from './outline';
import * as presentation from './presentation';
import * as project from './project';
import * as shareLink from './shareLink';

type OperationHandler = (
	this: IExecuteFunctions,
	itemIndex: number,
) => Promise<INodeExecutionData[]>;

const handlers: Record<string, Record<string, OperationHandler>> = {
	presentation: {
		createFromContent: presentation.createFromContent.execute,
		createFromFile: presentation.createFromFile.execute,
		createFromOutline: presentation.createFromOutline.execute,
		createFromTopic: presentation.createFromTopic.execute,
		createSingleSlide: presentation.createSingleSlide.execute,
		delete: presentation.delete.execute,
		download: presentation.download.execute,
		get: presentation.get.execute,
		getMany: presentation.getMany.execute,
		getOutline: presentation.getOutline.execute,
		update: presentation.update.execute,
	},
	job: {
		checkStatus: job.checkStatus.execute,
	},
	outline: {
		create: outline.create.execute,
	},
	access: {
		getMany: access.getMany.execute,
		grant: access.grant.execute,
		revoke: access.revoke.execute,
		update: access.update.execute,
	},
	account: {
		get: account.get.execute,
		getCredits: account.getCredits.execute,
	},
	brandKit: {
		get: brandKit.get.execute,
		getMany: brandKit.getMany.execute,
	},
	file: {
		delete: file.delete.execute,
		get: file.get.execute,
		upload: file.upload.execute,
	},
	project: {
		get: project.get.execute,
		getMany: project.getMany.execute,
	},
	shareLink: {
		create: shareLink.create.execute,
		delete: shareLink.delete.execute,
		get: shareLink.get.execute,
	},
};

// Resources whose items carry a presentation's generation status.
const PRESENTATION_STATUS_RESOURCES = ['presentation', 'job', 'outline'];

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
	// A file's status (File → Upload, File → Get) is not a presentation's.
	if (PRESENTATION_STATUS_RESOURCES.includes(resource)) {
		addNotReadyHint.call(this, operation, returnData);
	}
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
