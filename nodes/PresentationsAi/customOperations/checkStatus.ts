import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { extractApiErrorMessage, presentationsAiRequest } from '../shared/transport';

// Accepts either a bare job_id (e.g. "03267dc1-1338-4942-b44c-1ed3f0c83180")
// or a full pollUrl (e.g. "https://api.presentations.ai/api/v1/polljob/03267dc1-...").
// The API's previous async response shape returned `pollUrl` (full URL), so
// many user workflows naturally bind `$json.pollUrl` directly into this field;
// before this fix the routing concatenated the URL onto the base path and produced 404.
function extractJobId(input: string): string | undefined {
	const trimmed = input.trim();
	if (!trimmed) return undefined;
	if (/^https?:\/\//i.test(trimmed)) {
		const last = trimmed.split('?')[0].split('#')[0].split('/').filter(Boolean).pop();
		return last && last.length > 0 ? last : undefined;
	}
	return trimmed;
}

export async function checkStatus(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const raw = this.getNodeParameter('jobId', i, '') as string;
			const jobId = extractJobId(raw);
			if (!jobId) {
				throw new NodeOperationError(
					this.getNode(),
					'Job ID is required. Provide the job_id returned by a previous async operation, or the full pollUrl.',
					{ itemIndex: i },
				);
			}

			const response = (await presentationsAiRequest.call(
				this,
				'GET',
				`/api/v1/polljob/${encodeURIComponent(jobId)}`,
			)) as IDataObject;

			returnData.push({ json: response, pairedItem: { item: i } });
		} catch (error) {
			const message = extractApiErrorMessage(error);
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: message ?? (error as Error).message },
					pairedItem: { item: i },
				});
				continue;
			}
			if (error instanceof NodeOperationError) {
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				throw error;
			}
			throw new NodeApiError(
				this.getNode(),
				{ message: message ?? (error as Error).message },
				{ itemIndex: i },
			);
		}
	}

	return [returnData];
}
