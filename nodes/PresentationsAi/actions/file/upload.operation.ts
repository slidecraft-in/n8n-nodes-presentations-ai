import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeApiError, updateDisplayOptions } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import { getFile, uploadFile, waitForFile } from '../../transport';
import type { FileDetail } from '../../types';
import { FILE_READY_TIMEOUT_SECONDS, readUpload } from '../deck';
import { SUPPORTED_FILE_TYPES } from '../presentation/fields';
import { fileOutput } from './common';

const properties: INodeProperties[] = [
	{
		displayName:
			'Use the file_id with Presentations.AI\'s MCP server, which has no upload tool: pass it to create_presentation as a source { "type": "file", "file_id": … }',
		name: 'uploadNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Input Binary Field',
		name: 'binaryProperty',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the file to upload',
		description: `Binary field that holds the file: ${SUPPORTED_FILE_TYPES}, up to 150 MB`,
	},
	{
		displayName: 'Wait Until Read',
		name: 'waitForReady',
		type: 'boolean',
		default: true,
		description: `Whether to wait until Presentations.AI has read the file, up to ${FILE_READY_TIMEOUT_SECONDS / 60} minutes. A file can be used once its status is COMPLETED.`,
	},
];

const displayOptions = { show: { resource: ['file'], operation: ['upload'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const binaryProperty =
		toText(this.getNodeParameter('binaryProperty', itemIndex, 'data')).trim() || 'data';
	const waitForReady = this.getNodeParameter('waitForReady', itemIndex, true) as boolean;
	const upload = await readUpload.call(this, itemIndex, binaryProperty);
	const deadline = Date.now() + FILE_READY_TIMEOUT_SECONDS * 1000;

	let file: FileDetail = await uploadFile.call(this, upload.data, upload.fileName, upload.mimeType);
	if (waitForReady) {
		// Read once so the output has what extraction found (char_count), even
		// when the file is ready straight away.
		file = await getFile.call(this, file.file_id);
		file = await waitForFile.call(this, file, deadline);
		if (file.status === 'FAILED') {
			const message = `Presentations.AI couldn't read the file "${file.filename}"`;
			// No status/code keys: n8n would read them as an HTTP status code.
			throw new NodeApiError(
				this.getNode(),
				{ message, file_id: file.file_id },
				{
					message,
					description: `${file.error ?? 'No reason was given.'} Check that the file opens and is a supported type: ${SUPPORTED_FILE_TYPES}. File ID: ${file.file_id}`,
					itemIndex,
				},
			);
		}
	}
	return [{ json: fileOutput(file), pairedItem: { item: itemIndex } }];
}
