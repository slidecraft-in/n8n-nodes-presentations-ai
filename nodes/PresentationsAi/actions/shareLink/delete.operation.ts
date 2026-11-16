import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { deleteShareLink } from '../../transport';
import { readDeckId } from '../presentation/common';
import { presentationLocatorField } from '../presentation/fields';

// The API sets the presentation to Workspace, never back to Private.
export const UNSHARE_NOTICE =
	"Turns the link off, so it stops working. Then check who can open the presentation with 'Presentation → Get' (Visibility) and change it with 'Presentation → Update' if needed.";

const properties: INodeProperties[] = [
	presentationLocatorField,
	{
		displayName: UNSHARE_NOTICE,
		name: 'unshareNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = { show: { resource: ['shareLink'], operation: ['delete'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	await deleteShareLink.call(this, deckId);
	return [{ json: { deck_id: deckId, deleted: true }, pairedItem: { item: itemIndex } }];
}
