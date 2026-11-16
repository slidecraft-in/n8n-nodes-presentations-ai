import type { INodeProperties } from 'n8n-workflow';

import * as getMany from './getMany.operation';
import * as grant from './grant.operation';
import * as revoke from './revoke.operation';
import * as update from './update.operation';

export { getMany, grant, revoke, update };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['access'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get the people a presentation is shared with',
				description:
					"List the people a presentation is shared with and their roles. Needs the 'decks:share' scope.",
			},
			{
				name: 'Grant',
				value: 'grant',
				action: 'Share a presentation with a person',
				description:
					'Share a presentation with one person by email or user ID. No email is sent; the person can open it once that email belongs to a verified Presentations.AI user. Granting again replaces the role.',
				// Kept away from AI Agents: it changes who can open the presentation.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				name: 'Revoke',
				value: 'revoke',
				action: 'Stop sharing a presentation with a person',
				description: 'Stop sharing a presentation with one person',
				// Kept away from AI Agents: it changes who can open the presentation.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Change the role of a person on a presentation',
				description:
					'Change whether a person a presentation is shared with can view, comment or edit',
				// Kept away from AI Agents: it changes who can open the presentation.
				displayOptions: { show: { '@tool': [false] } },
			},
		],
		// Get Many is the one operation AI Agents can use, so it is the default.
		default: 'getMany',
	},
	...getMany.description,
	...grant.description,
	...revoke.description,
	...update.description,
];
