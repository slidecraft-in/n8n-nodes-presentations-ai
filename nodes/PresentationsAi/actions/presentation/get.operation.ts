import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { simplifyDeck } from '../../helpers/utils';
import { getDeck } from '../../transport';
import { readDeckId } from './common';
import { presentationLocatorField, simplifyField } from './fields';

const properties: INodeProperties[] = [presentationLocatorField, simplifyField];

const displayOptions = { show: { resource: ['presentation'], operation: ['get'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deck = await getDeck.call(this, readDeckId.call(this, itemIndex));
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;
	return [{ json: simplify ? simplifyDeck(deck) : deck, pairedItem: { item: itemIndex } }];
}
