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
				description: 'Poll for the result of an async presentation job started with a callback URL or "Return Job ID Immediately" set to true',
				routing: {
					request: {
						method: 'GET',
						url: '=/api/v1/polljob/{{$parameter["jobId"]}}',
					},
				},
			},
		],
		default: 'checkStatus',
	},
	{
		displayName: 'Job ID',
		name: 'jobId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. job_abc123',
		description: 'The job_id returned by a previous async presentation operation',
		displayOptions: { show: { resource: ['job'], operation: ['checkStatus'] } },
	},
];
