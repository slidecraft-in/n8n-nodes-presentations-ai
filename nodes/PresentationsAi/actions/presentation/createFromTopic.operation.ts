import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import { createDeckForItem } from '../deck';
import { commonCreateFields, slideCountField, topicField } from './fields';

const properties: INodeProperties[] = [topicField, slideCountField, ...commonCreateFields];

const displayOptions = { show: { resource: ['presentation'], operation: ['createFromTopic'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const topic = toText(this.getNodeParameter('topic', itemIndex, ''));
	if (!topic.trim()) {
		throw new NodeOperationError(this.getNode(), "The 'Topic' parameter is empty", {
			itemIndex,
			description: 'Enter what the presentation should be about.',
		});
	}
	const slideCount = this.getNodeParameter('slideCount', itemIndex) as number;
	return [await createDeckForItem.call(this, itemIndex, { topic, slideCount })];
}
