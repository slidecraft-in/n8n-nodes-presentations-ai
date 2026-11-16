import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { getFile } from '../../transport';
import { fileIdField, readFileId } from './common';

const properties: INodeProperties[] = [fileIdField];

const displayOptions = { show: { resource: ['file'], operation: ['get'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const file = await getFile.call(this, readFileId.call(this, itemIndex));
	return [{ json: file, pairedItem: { item: itemIndex } }];
}
