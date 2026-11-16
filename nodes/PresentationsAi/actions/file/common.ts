import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import type { FileDetail } from '../../types';

export const fileIdField: INodeProperties = {
	displayName: 'File ID',
	name: 'fileId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'e.g. {{ $json.file_id }}',
	description: "The file_id returned by 'Upload'",
};

export function readFileId(this: IExecuteFunctions, itemIndex: number): string {
	const fileId = toText(this.getNodeParameter('fileId', itemIndex, '')).trim();
	if (!fileId) {
		throw new NodeOperationError(this.getNode(), "The 'File ID' parameter is empty", {
			itemIndex,
			description: "Map the 'file_id' returned by the 'Upload' operation.",
		});
	}
	return fileId;
}

// The same fields for an upload whether or not the node waited for it.
export function fileOutput(file: FileDetail): IDataObject {
	return {
		file_id: file.file_id,
		filename: file.filename,
		status: file.status ?? null,
		error: file.error ?? null,
		char_count: file.char_count ?? null,
		size_bytes: file.size_bytes ?? null,
		content_type: file.content_type ?? null,
	};
}
