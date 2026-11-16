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
		displayOptions: { show: { resource: ['project'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a project',
				description: "Get a project or folder by its ID. Needs the 'projects:read' scope.",
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many projects',
				description:
					"List the workspace's projects or folders, optionally by name. Needs the 'projects:read' scope.",
			},
		],
		default: 'getMany',
	},
	...get.description,
	...getMany.description,
];
