import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';
import * as del from './delete.operation';
import * as get from './get.operation';

export { create, del as delete, get };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['shareLink'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a public link to a presentation',
				description:
					'Make the presentation public and get its link. Anyone with the link — and everyone in your workspace — can view it.',
				// Kept away from AI Agents: it makes the presentation public.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete the public link to a presentation',
				description: del.UNSHARE_NOTICE,
				// Kept away from AI Agents: it changes who can open the presentation.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get the public link to a presentation',
				description:
					"Get the presentation's public link. When link sharing is off, there is no link and has_share_link is false.",
			},
		],
		// Get is the one operation AI Agents can use, so it is the default.
		default: 'get',
	},
	...create.description,
	...del.description,
	...get.description,
];
