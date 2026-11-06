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

	documentationUrl = 'https://docs.presentations.ai';

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
			placeholder: 'pai_live_...',
			description:
				'Your Presentations.AI API key. Create one at https://api.presentations.ai/#/apikeys. Keys start with "pai_live_".',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.presentations.ai',
			description:
				'Base URL of the Presentations.AI API. Keep the default unless Presentations.AI support asks you to change it.',
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
			// Same rules as the node: empty means production; a trailing slash or /api/v1 is ignored.
			baseURL:
				'={{ ($credentials.baseUrl || "https://api.presentations.ai").trim().replace(/\\/+$/, "").replace(/\\/api\\/v1$/i, "") }}',
			url: '/api/v1/me',
			method: 'GET',
		},
		rules: [
			{
				type: 'responseCode',
				properties: {
					value: 401,
					message:
						"This API key isn't valid here. Create a new key at https://api.presentations.ai/#/apikeys; keys from the previous Presentations.AI API no longer work.",
				},
			},
		],
	};
}
