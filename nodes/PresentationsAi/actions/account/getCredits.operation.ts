import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { getCredits } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName:
			"Needs an API key with the 'credits:view' scope, which the Deck automation preset includes",
		name: 'creditsNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = { show: { resource: ['account'], operation: ['getCredits'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const credits = await getCredits.call(this);
	return [
		{
			json: {
				workspace_id: credits.workspace_id,
				available: credits.available,
				active_granted: credits.active_granted,
				total_consumed: credits.total_consumed,
				// Presentations.AI starts work that uses credits only while the
				// balance is above zero. It can be negative.
				can_start_paid_work: credits.available > 0,
			},
			pairedItem: { item: itemIndex },
		},
	];
}
