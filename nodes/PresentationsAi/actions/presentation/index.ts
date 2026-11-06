import type { INodeProperties } from 'n8n-workflow';

import * as createFromContent from './createFromContent.operation';
import * as createFromFile from './createFromFile.operation';
import * as createFromTopic from './createFromTopic.operation';
import * as createSingleSlide from './createSingleSlide.operation';

export { createFromContent, createFromFile, createFromTopic, createSingleSlide };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['presentation'] } },
		options: [
			{
				name: 'Create From Content',
				value: 'createFromContent',
				action: 'Create presentation from text',
				description: 'Turn text such as an article, notes or a transcript into a presentation',
			},
			{
				name: 'Create From File',
				value: 'createFromFile',
				action: 'Create presentation from file',
				description: 'Turn a document such as a PDF, Word or PowerPoint file into a presentation',
				// AI Agent tool calls carry no binary input, so there is no file to send.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				name: 'Create From Topic',
				value: 'createFromTopic',
				action: 'Create presentation from topic',
				description: 'Generate a full presentation from a topic or brief',
			},
			{
				name: 'Create Single Slide',
				value: 'createSingleSlide',
				action: 'Create single slide presentation',
				description: 'Generate a presentation with one summary slide from a topic',
			},
		],
		default: 'createFromTopic',
	},
	...createFromContent.description,
	...createFromFile.description,
	...createFromTopic.description,
	...createSingleSlide.description,
];
