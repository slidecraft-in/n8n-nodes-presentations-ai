import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toOutline } from '../../helpers/outline';
import { createDeckForItem } from '../deck';
import { commonCreateFields } from './fields';

const properties: INodeProperties[] = [
	{
		displayName: 'Outline',
		name: 'outline',
		type: 'json',
		required: true,
		default: '',
		placeholder: 'e.g. {{ $json.outline }}',
		description:
			"The outline to build from: the output of 'Outline → Create' or 'Get Outline', edited or not. It needs a 'slides' list.",
	},
	...commonCreateFields,
];

const displayOptions = { show: { resource: ['presentation'], operation: ['createFromOutline'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const outline = toOutline(this.getNodeParameter('outline', itemIndex, ''));
	if (!outline) {
		throw new NodeOperationError(this.getNode(), "The 'Outline' parameter has no outline", {
			itemIndex,
			description:
				"Map the 'outline' from 'Outline → Create' or 'Get Outline'. An outline is JSON with a 'slides' list.",
		});
	}
	return [await createDeckForItem.call(this, itemIndex, { outline })];
}
