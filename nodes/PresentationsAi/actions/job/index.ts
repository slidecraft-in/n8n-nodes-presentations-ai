import type { INodeProperties } from 'n8n-workflow';

import * as checkStatus from './checkStatus.operation';

export { checkStatus };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['job'] } },
		options: [
			{
				// The value stays "checkStatus" so saved workflows keep working.
				name: 'Get Status',
				value: 'checkStatus',
				action: 'Get job status',
				description:
					"Check whether a presentation job is complete and optionally download the file. Use after creating with 'Wait for Completion' off.",
			},
		],
		default: 'checkStatus',
	},
	...checkStatus.description,
];
