import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { listGrants } from '../../transport';
import { readDeckId } from '../presentation/common';
import { presentationLocatorField } from '../presentation/fields';

const properties: INodeProperties[] = [
	presentationLocatorField,
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { returnAll: [false] } },
	},
];

const displayOptions = { show: { resource: ['access'], operation: ['getMany'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', itemIndex, 50) as number);
	// The API returns every grant at once, with no pages.
	const grants = await listGrants.call(this, deckId);
	return grants.slice(0, limit).map((grant) => ({ json: grant, pairedItem: { item: itemIndex } }));
}
