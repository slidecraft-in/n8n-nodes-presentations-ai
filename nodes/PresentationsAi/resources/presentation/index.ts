import type { INodeProperties } from 'n8n-workflow';

import { presentationSharedFields } from './shared';

const showForResource = { resource: ['presentation'] };

export const presentationDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForResource },
		options: [
			{
				name: 'Create From Topic',
				value: 'createFromTopic',
				action: 'Create a presentation from a topic',
				description: 'Generate a full deck from a single topic or brief',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/topic/document',
					},
				},
			},
			{
				name: 'Create Single Slide',
				value: 'createSingleSlide',
				action: 'Create a single slide',
				description: 'Generate one AI-designed slide from a topic',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/topic/singleslide',
					},
				},
			},
			{
				name: 'Create From Content',
				value: 'createFromContent',
				action: 'Create a presentation from raw text',
				description:
					'Convert raw text (articles, notes, meeting transcripts) into a slide deck',
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/document/content',
					},
				},
			},
			{
				name: 'Create From File',
				value: 'createFromFile',
				action: 'Create a presentation from a document file',
				description:
					'Convert an uploaded PDF, DOCX, PPTX, TXT, MD, or RTF file (max 5 MB) into a deck. Routed via a multipart upload handler.',
				// Routing bypassed — handled by customOperations.presentation.createFromFile
				routing: {
					request: {
						method: 'POST',
						url: '/api/v1/document/file',
					},
				},
			},
		],
		default: 'createFromTopic',
	},

	...presentationSharedFields,
];
