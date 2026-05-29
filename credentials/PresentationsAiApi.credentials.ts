import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PresentationsAiApi implements ICredentialType {
	name = 'presentationsAiApi';

	displayName = 'Presentations.AI API';

	documentationUrl = 'https://console.presentations.ai/apiref/docs/';

	icon: Icon = {
		light: 'file:../nodes/PresentationsAi/presentations-ai.svg',
		dark: 'file:../nodes/PresentationsAi/presentations-ai.dark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'pai_...',
			description:
				'Your Presentations.AI API key. Create one at console.presentations.ai. Keys start with "pai_".',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.presentations.ai',
			description:
				'Base URL for the Presentations.AI REST API. Override only if you are using a self-hosted or staging endpoint.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/api/v1/authenticate',
			method: 'GET',
		},
	};
}
