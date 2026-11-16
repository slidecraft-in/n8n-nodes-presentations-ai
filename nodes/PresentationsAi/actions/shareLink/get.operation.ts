import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, updateDisplayOptions } from 'n8n-workflow';

import { getHttpStatus } from '../../helpers/utils';
import { getDeck, getShareLink } from '../../transport';
import type { ShareLink } from '../../types';
import { readDeckId } from '../presentation/common';
import { presentationLocatorField } from '../presentation/fields';

const properties: INodeProperties[] = [presentationLocatorField];

const displayOptions = { show: { resource: ['shareLink'], operation: ['get'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	let link: ShareLink;
	try {
		link = await getShareLink.call(this, deckId);
	} catch (error) {
		if (getHttpStatus(error) !== '404') throw new NodeApiError(this.getNode(), error as JsonObject);
		// The API answers 404 both when link sharing is off and when there is no
		// such presentation. Reading the presentation tells the two apart, and
		// fails with its own error when it is missing.
		await getDeck.call(this, deckId);
		return [
			{
				json: { deck_id: deckId, url: null, has_share_link: false },
				pairedItem: { item: itemIndex },
			},
		];
	}
	return [
		{
			json: { deck_id: deckId, url: link.url, has_share_link: true },
			pairedItem: { item: itemIndex },
		},
	];
}
