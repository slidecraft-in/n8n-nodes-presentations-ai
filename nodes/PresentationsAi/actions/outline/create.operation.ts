import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toLanguageName } from '../../helpers/deckBody';
import { buildRequestId, isValidRequestId } from '../../helpers/requestId';
import { getApiErrorBody, getHttpStatus, toText } from '../../helpers/utils';
import { createOutline, type CreateOutlineBody } from '../../transport';
import type { DeckSource } from '../../types';
import { FILE_READY_TIMEOUT_SECONDS, readUpload, uploadAndWait } from '../deck';

const properties: INodeProperties[] = [
	{
		displayName:
			'Uses credits: 10 per slide, charged once when the outline is made. Building a presentation from it uses credits again.',
		name: 'outlineCostNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Topic or Instructions',
		name: 'topic',
		type: 'string',
		typeOptions: { rows: 2 },
		default: '',
		placeholder: 'e.g. A 10-minute update on our hiring plan for the leadership team',
		description: "What the presentation should cover. Optional when 'Content' or a file is given.",
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		placeholder: 'e.g. Paste an article, notes or a transcript',
		description: 'Text to build the outline from. Optional when a topic or a file is given.',
	},
	{
		displayName: 'Slide Count',
		name: 'slideCount',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 50 },
		default: 10,
		description: 'Number of slides, including the cover. Credits are charged per slide.',
	},
	{
		displayName: 'Language',
		name: 'language',
		type: 'string',
		default: 'auto',
		placeholder: 'e.g. Spanish',
		description:
			"Language of the outline, as an English name such as 'Spanish'. 'auto' follows the language of the topic, content or file.",
	},
	{
		displayName: 'Level of Detail',
		name: 'levelOfDetail',
		type: 'options',
		options: [
			{ name: 'Brief', value: 'brief' },
			{ name: 'Detailed', value: 'detailed' },
			{ name: 'Standard', value: 'standard' },
			{ name: 'Very Detailed', value: 'very_detailed' },
		],
		default: 'standard',
		description: 'How much text goes on each slide',
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		options: [
			{
				displayName: 'Input Data Field Name',
				name: 'binaryProperty',
				type: 'string',
				default: '',
				placeholder: 'e.g. data',
				description:
					'Name of the binary field holding a file to build the outline from, such as a PDF or Word document',
				// AI Agent tool calls carry no binary input.
				displayOptions: { show: { '@tool': [false] } },
			},
			{
				displayName: 'Request ID',
				name: 'requestId',
				type: 'string',
				default: '',
				description:
					'Your own ID for this request, so a retry never pays twice. Leave empty to have one generated per node run and item.',
			},
		],
	},
];

const displayOptions = { show: { resource: ['outline'], operation: ['create'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const options = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
	const prompt = toText(this.getNodeParameter('topic', itemIndex, '')).trim();
	const content = toText(this.getNodeParameter('content', itemIndex, '')).trim();
	const binaryProperty = toText(options.binaryProperty).trim();

	if (!prompt && !content && !binaryProperty) {
		throw new NodeOperationError(this.getNode(), 'Nothing to build the outline from', {
			itemIndex,
			description:
				"Fill in 'Topic or Instructions' or 'Content', or add 'Input Data Field Name' under 'Options' for a file.",
		});
	}

	const customRequestId = toText(options.requestId).trim();
	if (customRequestId && !isValidRequestId(customRequestId)) {
		throw new NodeOperationError(
			this.getNode(),
			"The 'Request ID' option has characters Presentations.AI doesn't accept",
			{
				itemIndex,
				description:
					'Start with a letter or digit and use only letters, digits and . _ : ~ - (up to 255 characters).',
			},
		);
	}
	const requestId =
		customRequestId ||
		buildRequestId({
			instanceId: this.getInstanceId(),
			workflowId: toText(this.getWorkflow().id),
			executionId: this.getExecutionId(),
			// Kept apart from the IDs of presentations this node might create.
			nodeId: `${this.getNode().id}:outline`,
			runIndex: this.getWorkflowDataProxy(itemIndex).$thisRunIndex,
			itemIndex,
		});

	const sources: DeckSource[] = [];
	if (content) sources.push({ type: 'text', content });
	if (binaryProperty) {
		const upload = await readUpload.call(this, itemIndex, binaryProperty);
		const deadline = Date.now() + FILE_READY_TIMEOUT_SECONDS * 1000;
		sources.push({
			type: 'file',
			file_id: await uploadAndWait.call(this, itemIndex, upload, deadline),
		});
	}

	const body: CreateOutlineBody = {
		slide_count: String(
			Math.min(
				Math.max(Math.round(Number(this.getNodeParameter('slideCount', itemIndex, 10))) || 10, 1),
				50,
			),
		),
		level_of_detail:
			toText(this.getNodeParameter('levelOfDetail', itemIndex, 'standard')) || 'standard',
	};
	if (prompt) body.prompt = prompt;
	if (sources.length) body.sources = sources;
	const language = toLanguageName(toText(this.getNodeParameter('language', itemIndex, 'auto')));
	if (language) body.language = language;

	try {
		const response = await createOutline.call(this, requestId, body);
		return [{ json: { request_id: requestId, ...response }, pairedItem: { item: itemIndex } }];
	} catch (error) {
		// 409 here means a file is still being read, or this Request ID already
		// paid for an outline, which the API doesn't return twice.
		if (getHttpStatus(error) === '409') {
			const message =
				getApiErrorBody(error)?.message ?? 'Presentations.AI refused this outline request';
			throw new NodeApiError(
				this.getNode(),
				{ message },
				{
					message,
					description: `If this Request ID already made an outline, it wasn't charged again, but the outline isn't returned twice: leave 'Request ID' empty or use a new one to make a new outline (which uses credits). If a file is still being read, run the node again shortly. Request ID: ${requestId}`,
					itemIndex,
				},
			);
		}
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
