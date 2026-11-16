import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { deleteGrant } from '../../transport';
import { readDeckId } from '../presentation/common';
import { presentationLocatorField } from '../presentation/fields';
import { grantIdField, readGrantId } from './common';

const properties: INodeProperties[] = [presentationLocatorField, grantIdField];

const displayOptions = { show: { resource: ['access'], operation: ['revoke'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	const grantId = readGrantId.call(this, itemIndex);
	await deleteGrant.call(this, deckId, grantId);
	return [
		{
			json: { deck_id: deckId, grant_id: grantId, revoked: true },
			pairedItem: { item: itemIndex },
		},
	];
}
