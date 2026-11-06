import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import { createDeckForItem } from '../deck';
import {
	commonCreateFields,
	optionalTopicField,
	preservationModeField,
	slideCountField,
} from './fields';

const properties: INodeProperties[] = [
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: { rows: 8 },
		required: true,
		default: '',
		placeholder: 'Paste the text to turn into slides…',
		description:
			'Text to build the presentation from, such as an article, notes or a meeting transcript (up to 200,000 characters)',
	},
	optionalTopicField,
	preservationModeField,
	slideCountField,
	...commonCreateFields,
];

const displayOptions = { show: { resource: ['presentation'], operation: ['createFromContent'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const content = toText(this.getNodeParameter('content', itemIndex, ''));
	if (!content.trim()) {
		throw new NodeOperationError(this.getNode(), "The 'Content' parameter is empty", {
			itemIndex,
			description: 'Enter or map the text to turn into a presentation.',
		});
	}
	const topic = toText(this.getNodeParameter('topic', itemIndex, ''));
	const preservationMode = toText(this.getNodeParameter('preservationMode', itemIndex, 'enhance'));
	if (preservationMode === 'instruction' && !topic.trim()) {
		throw new NodeOperationError(this.getNode(), "The 'Topic or Instructions' parameter is empty", {
			itemIndex,
			description:
				"'Preservation Mode' is set to 'Instruction', which needs instructions. Add them, or choose another mode.",
		});
	}
	const slideCount = this.getNodeParameter('slideCount', itemIndex) as number;
	return [
		await createDeckForItem.call(this, itemIndex, {
			content,
			topic,
			preservationMode,
			slideCount,
		}),
	];
}
