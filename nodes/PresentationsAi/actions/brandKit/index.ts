import type { INodeProperties } from 'n8n-workflow';

import * as get from './get.operation';
import * as getMany from './getMany.operation';

export { get, getMany };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['brandKit'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a brand kit',
				description:
					"Get a brand kit's colours, fonts, logo and description by its ID. Needs the 'brand_kits:read' scope.",
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many brand kits',
				description:
					"List brand kits, optionally by name, domain or type. Use a brand kit's ID to style a new presentation. Needs the 'brand_kits:read' scope.",
			},
		],
		default: 'getMany',
	},
	...get.description,
	...getMany.description,
];
