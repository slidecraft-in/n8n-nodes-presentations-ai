import type { INodeProperties } from 'n8n-workflow';

import * as del from './delete.operation';
import * as get from './get.operation';
import * as upload from './upload.operation';

export { del as delete, get, upload };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['file'] } },
		options: [
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete an uploaded file',
				description: 'Delete a file uploaded to Presentations.AI',
				// Kept away from AI Agents: it can't be undone.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get an uploaded file and whether it has been read',
				description:
					'Get an uploaded file by its file_id, including whether Presentations.AI has finished reading it',
			},
			{
				name: 'Upload',
				value: 'upload',
				action: 'Upload a file',
				description:
					"Upload a file and get its file_id, for example to use with Presentations.AI's MCP server",
				// AI Agent tool calls carry no binary input, so there is no file to send.
				displayOptions: { show: { '@tool': [false] } },
			},
		],
		// Get is the one operation AI Agents can use, so it is the default.
		default: 'get',
	},
	...del.description,
	...get.description,
	...upload.description,
];
