import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import * as access from './actions/access';
import * as account from './actions/account';
import * as brandKit from './actions/brandKit';
import * as file from './actions/file';
import * as job from './actions/job';
import * as outline from './actions/outline';
import * as presentation from './actions/presentation';
import * as project from './actions/project';
import * as shareLink from './actions/shareLink';
import { router } from './actions/router';
import { searchBrandKits, searchPresentations, searchProjects } from './methods/listSearch';

export class PresentationsAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Presentations.AI',
		name: 'presentationsAi',
		icon: { light: 'file:presentations-ai.svg', dark: 'file:presentations-ai.dark.svg' },
		group: ['transform'],
		// Each version changes defaults; saved nodes keep the version they were
		// made with. 2: Language 'auto', Visibility 'Private'. 3: Export Format PDF.
		version: [1, 2, 3],
		defaultVersion: 3,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Create AI-generated slide decks from a topic, text or document with Presentations.AI and get the finished file back',
		defaults: { name: 'Presentations.AI' },
		usableAsTool: true,
		builderHint: {
			searchHint:
				"Creates presentations with Presentations.AI. Create operations wait for the presentation and return the file in the binary field 'data' (PPTX, PDF, or a ZIP of slide images) with JSON fields status, request_id, deck_url and share_url. With 'Wait for Completion' off they return at once; use the Job resource's 'Get Status' operation with request_id to check on it and download the file. Create From File needs a binary file from an earlier node.",
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'presentationsAiApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Access', value: 'access' },
					{ name: 'Account', value: 'account' },
					{ name: 'Brand Kit', value: 'brandKit' },
					{ name: 'File', value: 'file' },
					{ name: 'Job', value: 'job' },
					{ name: 'Outline', value: 'outline' },
					{ name: 'Presentation', value: 'presentation' },
					{ name: 'Project', value: 'project' },
					{ name: 'Share Link', value: 'shareLink' },
				],
				default: 'presentation',
			},
			...presentation.description,
			...job.description,
			...outline.description,
			...access.description,
			...account.description,
			...brandKit.description,
			...file.description,
			...project.description,
			...shareLink.description,
		],
	};

	methods = {
		listSearch: { searchBrandKits, searchPresentations, searchProjects },
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return await router.call(this);
	}
}
