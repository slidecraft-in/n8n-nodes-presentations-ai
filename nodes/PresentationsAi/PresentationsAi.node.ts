import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

import { createFromFile } from './customOperations/createFromFile';
import { jobDescription } from './resources/job';
import { presentationDescription } from './resources/presentation';

export class PresentationsAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Presentations.AI',
		name: 'presentationsAi',
		icon: { light: 'file:presentations-ai.svg', dark: 'file:presentations-ai.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Generate, transform, and export AI-powered slide decks from a topic, raw text, or document file via the Presentations.AI REST API.',
		defaults: { name: 'Presentations.AI' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'presentationsAiApi', required: true }],
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Job', value: 'job' },
					{ name: 'Presentation', value: 'presentation' },
				],
				default: 'presentation',
			},
			...presentationDescription,
			...jobDescription,
		],
	};

	customOperations = {
		presentation: {
			createFromFile,
		},
	};
}
