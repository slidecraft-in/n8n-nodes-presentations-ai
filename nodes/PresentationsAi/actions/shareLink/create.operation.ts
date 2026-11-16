import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { createShareLink } from '../../transport';
import { readDeckId } from '../presentation/common';
import { presentationLocatorField } from '../presentation/fields';

export const SHARE_NOTICE = 'Anyone with the link — and everyone in your workspace — can view it.';

const properties: INodeProperties[] = [
	presentationLocatorField,
	{
		displayName: `This makes the presentation public. ${SHARE_NOTICE}`,
		name: 'shareLinkNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Make a New Link',
		name: 'rotate',
		type: 'boolean',
		default: false,
		description: 'Whether to make a new link; the previous link stops working',
	},
];

const displayOptions = { show: { resource: ['shareLink'], operation: ['create'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	const rotate = this.getNodeParameter('rotate', itemIndex, false) === true;
	const link = await createShareLink.call(this, deckId, rotate);
	return [{ json: { deck_id: deckId, url: link.url }, pairedItem: { item: itemIndex } }];
}
