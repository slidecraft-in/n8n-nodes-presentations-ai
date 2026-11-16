import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { updateGrant } from '../../transport';
import { readDeckId } from '../presentation/common';
import { presentationLocatorField } from '../presentation/fields';
import { grantIdField, readGrantId, readRole, roleField } from './common';

const properties: INodeProperties[] = [presentationLocatorField, grantIdField, roleField];

const displayOptions = { show: { resource: ['access'], operation: ['update'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	const grantId = readGrantId.call(this, itemIndex);
	const role = readRole.call(this, itemIndex);
	const grant = await updateGrant.call(this, deckId, grantId, { role });
	return [{ json: grant, pairedItem: { item: itemIndex } }];
}
