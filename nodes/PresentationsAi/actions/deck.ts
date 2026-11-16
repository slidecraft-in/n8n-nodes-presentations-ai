import { createHash } from 'crypto';

import type {
	IBinaryData,
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { buildDeckRequest, toVisibility } from '../helpers/deckBody';
import { buildRequestId, deriveRequestId, isValidRequestId } from '../helpers/requestId';
import {
	getApiErrorBody,
	getHttpStatus,
	locatorValue,
	simplifyDeckResponse,
	toText,
} from '../helpers/utils';
import {
	CREDENTIAL_TYPE,
	createDeck,
	createShareLink,
	downloadExport,
	getDeck,
	getGenerationRequest,
	getMe,
	isSettled,
	mentionsSuspension,
	normalizeBaseUrl,
	SUSPENDED_HINT,
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
export const FILE_READY_TIMEOUT_SECONDS = 300;

type CreateOptions = {
	brandKitId?: unknown;
	projectId?: unknown;
	deckTitle?: string;
	levelOfDetail?: string;
	model?: string;
	outputBinaryField?: string;
	requestId?: string;
	speakerNotes?: boolean;
	name?: string;
	company?: string;
	insiderContent?: string;
	purpose?: string;
	delivery?: string;
	missingFigures?: string;
	qualityTier?: string;
	deepResearch?: boolean;
	allowedGraphics?: string;
};

export type FileUpload = { data: Buffer; fileName: string; mimeType: string };

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

// Version 3's Request ID for these inputs: the first attempt whose
// presentation wasn't FAILED or deleted, with that presentation if one exists,
// or the next unused attempt. Same rule as Presentations.AI's MCP server.
const MAX_DERIVED_ATTEMPTS = 25;

async function resolveDerivedRequest(
	this: IExecuteFunctions,
	itemIndex: number,
	request: unknown,
): Promise<{ requestId: string; existing?: GeneratedDeckResponse }> {
	// Per user, as Presentations.AI's MCP server does, so a new key for the same
	// person still matches. Falls back to the key when /me can't be read.
	const credentials = await this.getCredentials(CREDENTIAL_TYPE);
	const account = await keyAccount.call(this);
	const owner = account?.user_id
		? `user|${normalizeBaseUrl(credentials.baseUrl)}|${account.workspace_id ?? ''}|${account.user_id}`
		: `key|${normalizeBaseUrl(credentials.baseUrl)}|${toText(credentials.apiKey)}`;
	const failedHere = failedByExecution.get(this.getExecutionId() ?? '');
	for (let attempt = 1; attempt <= MAX_DERIVED_ATTEMPTS; attempt++) {
		const requestId = deriveRequestId(owner, request, attempt);
		const existing = await findExistingRequest.call(this, requestId);
		if (!existing) return { requestId };
		if (existing.status === 'FAILED') {
			if (failedHere?.has(requestId)) return { requestId, existing };
			continue;
		}
		if (!(await deckExists.call(this, existing.deck_id))) continue;
		return { requestId, existing };
	}
	throw new NodeOperationError(
		this.getNode(),
		'Too many earlier presentations failed or were deleted for these same inputs',
		{
			itemIndex,
			description:
				"Change any input, or set 'Request ID' under 'Options' to a new value, to make a new presentation.",
		},
	);
}

async function deckExists(this: IExecuteFunctions, deckId: string): Promise<boolean> {
	try {
		await getDeck.call(this, deckId);
		return true;
	} catch (error) {
		if (getHttpStatus(error) === '404') return false;
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
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

export async function uploadAndWait(
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

// One GET /me per node run. An API key limited to a project can only create
// presentations inside that project, and the API doesn't default to it; the
// user ID keys version 3's Request IDs.
type KeyAccount = { project_id?: string | null; user_id?: string; workspace_id?: string };
const keyAccountByRun = new WeakMap<IExecuteFunctions, Promise<KeyAccount | undefined>>();

async function keyAccount(this: IExecuteFunctions): Promise<KeyAccount | undefined> {
	let pending = keyAccountByRun.get(this);
	if (!pending) {
		// A failed lookup isn't cached, and creating goes ahead without a project:
		// a workspace-wide key doesn't need one, and the API names the problem if a
		// project-limited key does.
		pending = (getMe.call(this) as Promise<KeyAccount>).catch(() => {
			keyAccountByRun.delete(this);
			return undefined;
		});
		keyAccountByRun.set(this, pending);
	}
	return await pending;
}

async function keyProject(this: IExecuteFunctions): Promise<string | undefined> {
	return (await keyAccount.call(this))?.project_id ?? undefined;
}

// Request IDs whose presentation FAILED in this execution. Retry On Fail runs
// the node again in the same execution; it gets the same failure back instead
// of starting (and possibly paying for) a new generation each time. A later
// execution moves on to a new attempt.
const failedByExecution = new Map<string, Set<string>>();

function rememberFailure(executionId: string, requestId: string): void {
	let failed = failedByExecution.get(executionId);
	if (!failed) {
		failed = new Set();
		failedByExecution.set(executionId, failed);
		// Keep only recent executions.
		if (failedByExecution.size > 200) {
			failedByExecution.delete(failedByExecution.keys().next().value as string);
		}
	}
	failed.add(requestId);
}

// The API makes a presentation visible to the whole workspace when no
// visibility is sent, so an empty value means Private and an unknown one
// (such as 'public' from an expression) stops before anything is created.
export function readVisibility(this: IExecuteFunctions, itemIndex: number): string {
	const value = toText(this.getNodeParameter('visibility', itemIndex, 'private')).trim();
	if (!value) return 'private';
	if (!toVisibility(value)) {
		throw new NodeOperationError(
			this.getNode(),
			`'Visibility' must be Private, Project or Workspace, not '${value}'`,
			{
				itemIndex,
				description:
					"A presentation becomes public only through 'Create Share Link'. Choose Private, Project or Workspace.",
			},
		);
	}
	return value;
}

export function clampWaitSeconds(value: unknown): number {
	const seconds = Number(value);
	if (!Number.isFinite(seconds)) return DEFAULT_MAX_WAIT_SECONDS;
	return Math.min(Math.max(seconds, 1), MAX_WAIT_SECONDS);
}

// The API falls back to the file extension when the type is generic, so the
// upload always carries a name with one.
export function uploadFileName(binary: IBinaryData): string {
	if (binary.fileName) return binary.fileName;
	return binary.fileExtension ? `document.${binary.fileExtension}` : 'document';
}

// The file in an item's binary field, ready to upload. Names the fields the
// item does have when the expected one is missing.
export async function readUpload(
	this: IExecuteFunctions,
	itemIndex: number,
	binaryProperty: string,
): Promise<FileUpload> {
	const available = Object.keys(this.getInputData()[itemIndex]?.binary ?? {});
	if (!available.includes(binaryProperty)) {
		throw new NodeOperationError(this.getNode(), `No file in the '${binaryProperty}' field`, {
			itemIndex,
			description: `Set 'Input Binary Field' to the field that holds the file. This item has: ${available.join(', ') || 'no files'}. A Form Trigger names the field after the form field's Field Name.`,
		});
	}
	const binary = this.helpers.assertBinaryData(itemIndex, binaryProperty);
	return {
		data: await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty),
		fileName: uploadFileName(binary),
		mimeType: binary.mimeType || 'application/octet-stream',
	};
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
	const typeVersion = this.getNode().typeVersion;
	const exportType = toText(this.getNodeParameter('exportType', itemIndex, 'pptx'));
	// 'share' was an export format in 0.2.x and makes a public link. Only
	// version 1 nodes, where those saved workflows live, still honour it.
	if (typeVersion >= 2 && exportType.trim().toLowerCase() === 'share') {
		throw new NodeOperationError(this.getNode(), "'Export Format' can't be 'share'", {
			itemIndex,
			description:
				"Choose PDF, PPTX or Image. To share a link, turn on 'Create Share Link': anyone with the link — and everyone in your workspace — can view it.",
		});
	}
	// A blank language means English to the API, so version 2 and later send
	// 'auto' to follow the content instead.
	const languageText = toText(this.getNodeParameter('language', itemIndex, '')).trim();
	const language = typeVersion >= 2 && !languageText ? 'auto' : languageText;

	const body = buildDeckRequest({
		...inputs,
		exportType,
		targetAudience: toText(this.getNodeParameter('targetAudience', itemIndex, '')),
		language,
		domain: toText(this.getNodeParameter('domain', itemIndex, '')),
		deckTitle: toText(options.deckTitle),
		model: toText(options.model),
		levelOfDetail: toText(options.levelOfDetail),
		speakerNotes: options.speakerNotes === true,
		name: toText(options.name),
		company: toText(options.company),
		insiderContent: toText(options.insiderContent),
		purpose: toText(options.purpose),
		delivery: toText(options.delivery),
		missingFigures: toText(options.missingFigures),
		qualityTier: toText(options.qualityTier),
		deepResearch: options.deepResearch === true,
		allowedGraphics: toText(options.allowedGraphics),
		brandKitId: locatorValue(options.brandKitId),
		projectId: locatorValue(options.projectId) || (await keyProject.call(this)),
		// Version 1 sent no visibility, so its decks stay workspace-visible.
		visibility: this.getNode().typeVersion >= 2 ? readVisibility.call(this, itemIndex) : undefined,
	});
	if (body.visibility === 'PROJECT' && !body.project_id) {
		throw new NodeOperationError(
			this.getNode(),
			"'Visibility' is 'Project', but no project is set",
			{
				itemIndex,
				description:
					"Choose a project in 'Project' under 'Options', or choose another 'Visibility'. A project is needed so Presentations.AI knows who can open the presentation.",
			},
		);
	}

	const upload = file ? await readUpload.call(this, itemIndex, file.binaryProperty) : undefined;

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
	const deadline = startedAt + maxWaitSeconds * 1000;
	// Text extraction is a precondition, so it gets at least its own window.
	const fileDeadline = Math.max(deadline, startedAt + FILE_READY_TIMEOUT_SECONDS * 1000);

	let requestId: string;
	let response: GeneratedDeckResponse | undefined;
	let derived = false;
	if (customRequestId) {
		requestId = customRequestId;
	} else if (this.getNode().typeVersion >= 3) {
		// The file's content, not its upload ID, so the same file matches again.
		const request = upload
			? {
					...body,
					file: {
						sha256: createHash('sha256').update(upload.data).digest('hex'),
						name: upload.fileName,
					},
				}
			: body;
		({ requestId, existing: response } = await resolveDerivedRequest.call(
			this,
			itemIndex,
			request,
		));
		derived = true;
	} else {
		requestId = buildRequestId({
			instanceId: this.getInstanceId(),
			workflowId: toText(this.getWorkflow().id),
			executionId: this.getExecutionId(),
			nodeId: this.getNode().id,
			runIndex: this.getWorkflowDataProxy(itemIndex).$thisRunIndex,
			itemIndex,
		});
	}

	if (upload && !response) {
		// A retry of this item may already have created the deck; reuse it
		// rather than uploading the file again. Version 3 has just checked.
		if (!derived) response = await findExistingRequest.call(this, requestId);
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
			rememberFailure(this.getExecutionId() ?? '', response.request_id);
			const message = `Presentations.AI couldn't create the presentation: ${response.error ?? 'no reason given'}`;
			throw new NodeApiError(
				this.getNode(),
				{ message, request_id: response.request_id, deck_id: response.deck_id },
				{
					message,
					description: mentionsSuspension(response.error)
						? `${SUSPENDED_HINT}. Request ID: ${response.request_id}`
						: `Check the inputs and options, then run the node again. Request ID: ${response.request_id}`,
					itemIndex,
				},
			);
		}

		// "Share Link" was an export format in 0.2.x; saved workflows keep getting a link.
		const legacyShare = typeVersion === 1 && exportType === 'share';
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
