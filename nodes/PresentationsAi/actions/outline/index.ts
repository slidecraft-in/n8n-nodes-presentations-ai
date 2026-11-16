import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';

export { create };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['outline'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create an outline to review before making a presentation',
				description:
					"Draft a presentation's outline to review before building it with 'Create From Outline'. Uses 10 credits per slide, charged once.",
			},
		],
		default: 'create',
	},
	...create.description,
];
