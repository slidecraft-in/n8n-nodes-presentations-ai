import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import { createDeckForItem } from '../deck';
import {
	SUPPORTED_FILE_TYPES,
	commonCreateFields,
	optionalTopicField,
	preservationModeField,
	slideCountField,
} from './fields';

const properties: INodeProperties[] = [
	{
		displayName: 'Input Binary Field',
		name: 'binaryProperty',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the file to convert',
		description: `Binary field that holds the source document: ${SUPPORTED_FILE_TYPES}, up to 150 MB`,
	},
	optionalTopicField,
	preservationModeField,
	slideCountField,
	...commonCreateFields,
];

const displayOptions = { show: { resource: ['presentation'], operation: ['createFromFile'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const binaryProperty = toText(this.getNodeParameter('binaryProperty', itemIndex, 'data')).trim();
	const topic = toText(this.getNodeParameter('topic', itemIndex, ''));
	const preservationMode = toText(this.getNodeParameter('preservationMode', itemIndex, 'enhance'));
	if (preservationMode === 'instruction' && !topic.trim()) {
		throw new NodeOperationError(this.getNode(), "The 'Topic or Instructions' parameter is empty", {
			itemIndex,
			description:
				"'Preservation Mode' is set to 'Instruction', which needs instructions. Add them, or choose another mode.",
		});
	}
	const slideCount = this.getNodeParameter('slideCount', itemIndex) as number;
	return [
		await createDeckForItem.call(
			this,
			itemIndex,
			{ topic, preservationMode, slideCount },
			{ binaryProperty },
		),
	];
}
