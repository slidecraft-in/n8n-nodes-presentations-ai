import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { deleteDeck } from '../../transport';
import { readDeckId } from './common';
import { presentationLocatorField } from './fields';

const properties: INodeProperties[] = [
	presentationLocatorField,
	{
		displayName: "Deletes the presentation for everyone. This can't be undone from n8n.",
		name: 'deleteNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = { show: { resource: ['presentation'], operation: ['delete'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	// Deleting a presentation that is already deleted succeeds too.
	await deleteDeck.call(this, deckId);
	return [{ json: { deck_id: deckId, deleted: true }, pairedItem: { item: itemIndex } }];
}
