import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toExportFormat } from '../../helpers/deckBody';
import { toText } from '../../helpers/utils';
import { downloadExport, listExports } from '../../transport';
import { readDeckId } from './common';
import { outputBinaryFieldOption, presentationLocatorField } from './fields';

const FORMAT_LABEL = { PPTX: 'PPTX', PDF: 'PDF', IMAGE: 'Image' } as const;

const properties: INodeProperties[] = [
	presentationLocatorField,
	{
		displayName: 'Format',
		name: 'format',
		type: 'options',
		options: [
			{ name: 'Image', value: 'image', description: 'A ZIP file with one image per slide' },
			{ name: 'PDF', value: 'pdf' },
			{ name: 'PPTX', value: 'pptx', description: 'PowerPoint' },
		],
		default: 'pdf',
		description:
			'Which file to download. A presentation has the formats it was created with; this operation downloads the newest one and creates no new file.',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [outputBinaryFieldOption],
	},
];

const displayOptions = { show: { resource: ['presentation'], operation: ['download'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	const format = toExportFormat(toText(this.getNodeParameter('format', itemIndex, 'pdf')));
	const exports = await listExports.call(this, deckId);
	const latest = exports
		.filter((item) => item.format === format)
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

	if (!latest) {
		const available = [...new Set(exports.map((item) => FORMAT_LABEL[item.format] ?? item.format))];
		throw new NodeOperationError(
			this.getNode(),
			`This presentation has no ${FORMAT_LABEL[format]} file`,
			{
				itemIndex,
				description: available.length
					? `Choose a format it has: ${available.join(', ')}. Files are made when a presentation is created.`
					: "It has no files yet. If it's still being created, check it with 'Get Status' first.",
			},
		);
	}

	const options = this.getNodeParameter('options', itemIndex, {}) as { outputBinaryField?: string };
	const binaryField = toText(options.outputBinaryField).trim() || 'data';
	return [
		{
			json: {
				deck_id: latest.deck_id,
				export_id: latest.id,
				format: latest.format,
				content_type: latest.content_type,
				size_bytes: latest.size_bytes,
				created_at: latest.created_at,
			},
			binary: { [binaryField]: await downloadExport.call(this, latest) },
			pairedItem: { item: itemIndex },
		},
	];
}
