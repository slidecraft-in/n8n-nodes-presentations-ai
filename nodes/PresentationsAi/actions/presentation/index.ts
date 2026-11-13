import type { INodeProperties } from 'n8n-workflow';

import * as createFromContent from './createFromContent.operation';
import * as createFromFile from './createFromFile.operation';
import * as createFromOutline from './createFromOutline.operation';
import * as createFromTopic from './createFromTopic.operation';
import * as createSingleSlide from './createSingleSlide.operation';
import * as download from './download.operation';
import * as get from './get.operation';
import * as getMany from './getMany.operation';
import * as getOutline from './getOutline.operation';
import * as update from './update.operation';

export {
	createFromContent,
	createFromFile,
	createFromOutline,
	createFromTopic,
	createSingleSlide,
	download,
	get,
	getMany,
	getOutline,
	update,
};

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
				description:
					'Turn text such as an article, notes or a transcript into a presentation. Uses credits, charged per slide.',
			},
			{
				name: 'Create From File',
				value: 'createFromFile',
				action: 'Create presentation from file',
				description:
					'Turn a document such as a PDF, Word or PowerPoint file into a presentation. Uses credits, charged per slide.',
				// AI Agent tool calls carry no binary input, so there is no file to send.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				name: 'Create From Outline',
				value: 'createFromOutline',
				action: 'Create presentation from outline',
				description:
					"Build a presentation from an outline, such as one from 'Outline → Create' that someone reviewed. Uses credits, charged per slide.",
			},
			{
				name: 'Create From Topic',
				value: 'createFromTopic',
				action: 'Create presentation from topic',
				description:
					'Generate a full presentation from a topic or brief. Uses credits, charged per slide.',
			},
			{
				name: 'Create Single Slide',
				value: 'createSingleSlide',
				action: 'Create single slide presentation',
				description:
					'Generate a presentation with one summary slide from a topic. Uses credits, charged per slide.',
			},
			{
				name: 'Download',
				value: 'download',
				action: 'Download a presentation',
				description: 'Download the PPTX, PDF or slide images of an existing presentation',
				// AI Agent tool calls drop binary output.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a presentation',
				description: 'Get a presentation, its status and the file formats it has',
			},
			{
				name: 'Get Many',
				value: 'getMany',
				action: 'Get many presentations',
				description: 'List presentations, optionally by project or name',
			},
			{
				name: 'Get Outline',
				value: 'getOutline',
				action: 'Get a presentation outline',
				description: 'Get the outline a presentation was built from',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a presentation',
				description: 'Rename a presentation, move it to another project or change who can open it',
			},
		],
		default: 'createFromTopic',
	},
	...createFromContent.description,
	...createFromFile.description,
	...createFromOutline.description,
	...createFromTopic.description,
	...createSingleSlide.description,
	...download.description,
	...get.description,
	...getMany.description,
	...getOutline.description,
	...update.description,
];
