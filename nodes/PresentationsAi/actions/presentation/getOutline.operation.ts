import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { getDeckOutline } from '../../transport';
import { readDeckId } from './common';
import { presentationLocatorField } from './fields';

const properties: INodeProperties[] = [presentationLocatorField];

const displayOptions = { show: { resource: ['presentation'], operation: ['getOutline'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const outline = await getDeckOutline.call(this, readDeckId.call(this, itemIndex));
	return [{ json: outline, pairedItem: { item: itemIndex } }];
}
