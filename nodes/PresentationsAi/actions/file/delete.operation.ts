import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { deleteFile } from '../../transport';
import { fileIdField, readFileId } from './common';

const properties: INodeProperties[] = [fileIdField];

const displayOptions = { show: { resource: ['file'], operation: ['delete'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const fileId = readFileId.call(this, itemIndex);
	await deleteFile.call(this, fileId);
	return [{ json: { file_id: fileId, deleted: true }, pairedItem: { item: itemIndex } }];
}
