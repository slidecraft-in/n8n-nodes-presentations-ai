import type { INodeProperties } from 'n8n-workflow';

const showForResource = { resource: ['job'] };

export const jobDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForResource },
		options: [
			{
				name: 'Check Status',
				value: 'checkStatus',
				action: 'Check the status of an async job',
				description:
					'Poll for the result of an async presentation job. Accepts either a bare job_id or the full pollUrl returned by a previous async operation.',
			},
		],
		default: 'checkStatus',
	},
	{
		displayName: 'Job ID or Poll URL',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. 03267dc1-1338-4942-b44c-1ed3f0c83180 or {{ $json.pollUrl }}',
		description:
			'Accepts either the bare job_id returned by a previous async operation, or the full pollUrl (the trailing path segment is used as the job_id)',
		displayOptions: { show: { resource: ['job'], operation: ['checkStatus'] } },
	},
];
