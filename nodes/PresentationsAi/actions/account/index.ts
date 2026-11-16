import type { INodeProperties } from 'n8n-workflow';

import * as get from './get.operation';
import * as getCredits from './getCredits.operation';

export { get, getCredits };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get account details including plan and permissions',
				description:
					'Get who the API key belongs to, its workspace and project, the plan and what the key is allowed to do',
			},
			{
				name: 'Get Credits',
				value: 'getCredits',
				action: 'Get the credit balance of the workspace',
				description:
					"Get the workspace's credit balance and whether it can start work that uses credits. Needs the 'credits:view' scope, which the Deck automation preset includes.",
			},
		],
		default: 'get',
	},
	...get.description,
	...getCredits.description,
];
