import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { extractRequestId, toText } from '../../helpers/utils';
import { getGenerationRequest } from '../../transport';
import { toDeckItem } from '../deck';
import { outputBinaryFieldOption, simplifyField } from '../presentation/fields';

const properties: INodeProperties[] = [
	{
		displayName: 'Request ID or Status URL',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. {{ $json.request_id }}',
		description: 'The request_id or status_url returned by a Presentations.AI create operation',
	},
	{
		displayName: 'Download File',
		name: 'downloadFile',
		type: 'boolean',
		default: false,
		description:
			'Whether to download the presentation into the binary data of the item once it is complete',
		// Hidden for AI Agent tool calls, which drop binary output.
		displayOptions: { show: { '@tool': [false] } },
	},
	simplifyField,
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { downloadFile: [true] } },
		options: [outputBinaryFieldOption],
	},
];

const displayOptions = { show: { resource: ['job'], operation: ['checkStatus'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const requestId = extractRequestId(toText(this.getNodeParameter('jobId', itemIndex, '')));
	if (!requestId) {
		throw new NodeOperationError(
			this.getNode(),
			"The 'Request ID or Status URL' parameter is empty",
			{
				itemIndex,
				description:
					"Map the 'request_id' or 'status_url' returned by a Presentations.AI create operation.",
			},
		);
	}
	const response = await getGenerationRequest.call(this, requestId);
	const options = this.getNodeParameter('options', itemIndex, {}) as { outputBinaryField?: string };
	return [
		await toDeckItem.call(this, itemIndex, response, {
			download: this.getNodeParameter('downloadFile', itemIndex, false) as boolean,
			simplify: this.getNodeParameter('simplify', itemIndex, true) as boolean,
			binaryField: toText(options.outputBinaryField),
		}),
	];
}
