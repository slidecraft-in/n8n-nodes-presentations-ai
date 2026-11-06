import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { buildDeckRequest } from '../helpers/deckBody';
import { buildRequestId, isValidRequestId } from '../helpers/requestId';
import { getApiErrorBody, locatorValue, simplifyDeckResponse, toText } from '../helpers/utils';
import {
	createDeck,
	createShareLink,
	downloadExport,
	getGenerationRequest,
	getKeyProjectId,
	isSettled,
	uploadFile,
	waitForFile,
	waitForRequest,
} from '../transport';
import type { CreateDeckRequest, DeckInputs, GeneratedDeckResponse } from '../types';
import { withRequestId } from './errors';
import {
	DEFAULT_MAX_WAIT_SECONDS,
	MAX_WAIT_SECONDS,
	SUPPORTED_FILE_TYPES,
} from './presentation/fields';

// An uploaded file has to finish text extraction before the deck can be
// created, even when the node isn't waiting for the deck itself.
const FILE_READY_TIMEOUT_SECONDS = 300;

type CreateOptions = {
	brandKitId?: unknown;
	projectId?: unknown;
	deckTitle?: string;
	levelOfDetail?: string;
	model?: string;
	outputBinaryField?: string;
	requestId?: string;
	speakerNotes?: boolean;
};

type FileUpload = { data: Buffer; fileName: string; mimeType: string };

export async function toDeckItem(
	this: IExecuteFunctions,
	itemIndex: number,
	response: GeneratedDeckResponse,
	options: {
		download: boolean;
		simplify: boolean;
		shareLink?: boolean;
		binaryField?: string;
		title?: string;
	},
): Promise<INodeExecutionData> {
	const completed = response.status === 'COMPLETED';
	const shareLink =
		completed && options.shareLink ? await createShareLink.call(this, response.deck_id) : undefined;
	const json: IDataObject = options.simplify
		? simplifyDeckResponse(response, shareLink)
		: { ...response, ...(shareLink ? { share_link: shareLink } : {}) };
	const item: INodeExecutionData = { json, pairedItem: { item: itemIndex } };

	if (completed && options.download && response.export) {
		const binaryField = options.binaryField?.trim() || 'data';
		item.binary = {
			[binaryField]: await downloadExport.call(this, response.export, options.title),
		};
	}
	return item;
}

async function findExistingRequest(
	this: IExecuteFunctions,
	requestId: string,
): Promise<GeneratedDeckResponse | undefined> {
	try {
		return await getGenerationRequest.call(this, requestId);
	} catch (error) {
		if (getApiErrorBody(error)?.code === 'NOT_FOUND') return undefined;
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

async function uploadAndWait(
	this: IExecuteFunctions,
	itemIndex: number,
	upload: FileUpload,
	deadline: number,
): Promise<string> {
	const uploaded = await uploadFile.call(this, upload.data, upload.fileName, upload.mimeType);
	const file = await waitForFile.call(this, uploaded, deadline);

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
	if (file.status !== 'COMPLETED') {
		throw new NodeOperationError(
			this.getNode(),
			`The file "${file.filename}" is still being processed`,
			{
				itemIndex,
				description: `Increase 'Max Wait (Seconds)' or run the node again shortly. File ID: ${file.file_id}`,
			},
		);
	}
	return file.file_id;
}

async function submitDeck(
	this: IExecuteFunctions,
	requestId: string,
	body: CreateDeckRequest,
	waitSeconds: number,
	resumeOnConflict: boolean,
): Promise<GeneratedDeckResponse> {
	try {
		return await createDeck.call(this, requestId, body, waitSeconds);
	} catch (error) {
		// A generated ID belongs to one node run and item, so a conflict means a
		// retry of this same item sent a different body (a re-uploaded file gets a
		// new file_id, or an input changed between attempts). The deck from the
		// first attempt is the one to use.
		if (resumeOnConflict && getApiErrorBody(error)?.code === 'REQUEST_ID_CONFLICT') {
			return await getGenerationRequest.call(this, requestId);
		}
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

// One lookup per node run. An API key limited to a project can only create
// presentations inside that project, and the API doesn't default to it.
const keyProjectByRun = new WeakMap<IExecuteFunctions, Promise<string | undefined>>();

async function keyProject(this: IExecuteFunctions): Promise<string | undefined> {
	let pending = keyProjectByRun.get(this);
	if (!pending) {
		// A failed lookup isn't cached, and creating goes ahead without a project:
		// a workspace-wide key doesn't need one, and the API names the problem if a
		// project-limited key does.
		pending = getKeyProjectId.call(this).catch(() => {
			keyProjectByRun.delete(this);
			return undefined;
		});
		keyProjectByRun.set(this, pending);
	}
	return await pending;
}

function clampWaitSeconds(value: unknown): number {
	const seconds = Number(value);
	if (!Number.isFinite(seconds)) return DEFAULT_MAX_WAIT_SECONDS;
	return Math.min(Math.max(seconds, 1), MAX_WAIT_SECONDS);
}

// The API falls back to the file extension when the type is generic, so the
// upload always carries a name with one.
function uploadFileName(binary: IBinaryData): string {
	if (binary.fileName) return binary.fileName;
	return binary.fileExtension ? `document.${binary.fileExtension}` : 'document';
}

export async function createDeckForItem(
	this: IExecuteFunctions,
	itemIndex: number,
	inputs: DeckInputs,
	file?: { binaryProperty: string },
): Promise<INodeExecutionData> {
	const startedAt = Date.now();
	const waitForCompletion = this.getNodeParameter('waitForCompletion', itemIndex, true) as boolean;
	const maxWaitSeconds = waitForCompletion
		? clampWaitSeconds(this.getNodeParameter('maxWaitSeconds', itemIndex, DEFAULT_MAX_WAIT_SECONDS))
		: 0;
	const options = this.getNodeParameter('options', itemIndex, {}) as CreateOptions;
	const exportType = toText(this.getNodeParameter('exportType', itemIndex, 'pptx'));

	const body = buildDeckRequest({
		...inputs,
		exportType,
		targetAudience: toText(this.getNodeParameter('targetAudience', itemIndex, '')),
		language: toText(this.getNodeParameter('language', itemIndex, '')),
		domain: toText(this.getNodeParameter('domain', itemIndex, '')),
		deckTitle: toText(options.deckTitle),
		model: toText(options.model),
		levelOfDetail: toText(options.levelOfDetail),
		speakerNotes: options.speakerNotes === true,
		brandKitId: locatorValue(options.brandKitId),
		projectId: locatorValue(options.projectId) || (await keyProject.call(this)),
	});

	let upload: FileUpload | undefined;
	if (file) {
		const binary = this.helpers.assertBinaryData(itemIndex, file.binaryProperty);
		upload = {
			data: await this.helpers.getBinaryDataBuffer(itemIndex, file.binaryProperty),
			fileName: uploadFileName(binary),
			mimeType: binary.mimeType || 'application/octet-stream',
		};
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
			nodeId: this.getNode().id,
			runIndex: this.getWorkflowDataProxy(itemIndex).$thisRunIndex,
			itemIndex,
		});

	const deadline = startedAt + maxWaitSeconds * 1000;
	// Text extraction is a precondition, so it gets at least its own window.
	const fileDeadline = Math.max(deadline, startedAt + FILE_READY_TIMEOUT_SECONDS * 1000);

	let response: GeneratedDeckResponse | undefined;
	if (upload) {
		// A retry of this item may already have created the deck; reuse it
		// rather than uploading the file again.
		response = await findExistingRequest.call(this, requestId);
		if (!response) {
			const fileId = await uploadAndWait.call(this, itemIndex, upload, fileDeadline);
			body.sources = [...(body.sources ?? []), { type: 'file', file_id: fileId }];
		}
	}

	if (!response) {
		const waitSeconds = waitForCompletion ? Math.max(0, (deadline - Date.now()) / 1000) : 0;
		response = await submitDeck.call(this, requestId, body, waitSeconds, !customRequestId);
	}

	try {
		if (waitForCompletion && !isSettled(response.status)) {
			response = await waitForRequest.call(this, response, deadline);
		}

		if (response.status === 'FAILED') {
			const message = `Presentations.AI couldn't create the presentation: ${response.error ?? 'no reason given'}`;
			throw new NodeApiError(
				this.getNode(),
				{ message, request_id: response.request_id, deck_id: response.deck_id },
				{
					message,
					description: `Check the inputs and options, then run the node again. Request ID: ${response.request_id}`,
					itemIndex,
				},
			);
		}

		// "Share Link" was an export format in 0.2.x; saved workflows keep getting a link.
		const legacyShare = exportType === 'share';
		return await toDeckItem.call(this, itemIndex, response, {
			download:
				waitForCompletion && (this.getNodeParameter('downloadFile', itemIndex, false) as boolean),
			shareLink:
				waitForCompletion &&
				(legacyShare || (this.getNodeParameter('createShareLink', itemIndex, false) as boolean)),
			binaryField: toText(options.outputBinaryField),
			title: toText(options.deckTitle),
			simplify: this.getNodeParameter('simplify', itemIndex, true) as boolean,
		});
	} catch (error) {
		throw withRequestId.call(this, error, itemIndex, requestId);
	}
}
