import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { extractApiErrorMessage } from '../shared/transport';

const CREDENTIAL_NAME = 'presentationsAiApi';
const DEFAULT_BASE_URL = 'https://api.presentations.ai';
const FILE_ENDPOINT = '/api/v1/document/file';
const MAX_FILE_BYTES = 5 * 1024 * 1024; // server-side limit: 5 MB

// Presentations.AI's POST /api/v1/document/file accepts a multipart/form-data
// upload. n8n's declarative routing cannot model this, so the operation is
// dispatched here. Each input item must carry a binary property (default name
// "data") produced by an upstream node such as Read Binary File or HTTP Request.
export async function createFromFile(
	this: IExecuteFunctions,
): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	const returnData: INodeExecutionData[] = [];

	const credentials = await this.getCredentials(CREDENTIAL_NAME);
	const baseUrl = ((credentials.baseUrl as string) || DEFAULT_BASE_URL).replace(/\/$/, '');

	for (let i = 0; i < items.length; i++) {
		try {
			const binaryProperty = this.getNodeParameter('binaryProperty', i, 'data') as string;
			const binary = this.helpers.assertBinaryData(i, binaryProperty);
			const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProperty);

			if (buffer.length > MAX_FILE_BYTES) {
				throw new NodeOperationError(
					this.getNode(),
					`File exceeds the 5 MB upload limit (got ${(buffer.length / 1024 / 1024).toFixed(2)} MB). Compress or split the document before uploading.`,
					{ itemIndex: i },
				);
			}

			const exportType = this.getNodeParameter('exportType', i) as string;
			const topic = this.getNodeParameter('topic', i, '') as string;
			const slideCount = this.getNodeParameter('slideCount', i, undefined) as
				| number
				| undefined;
			const language = this.getNodeParameter('language', i, '') as string;
			const domain = this.getNodeParameter('domain', i, '') as string;
			const preservationMode = this.getNodeParameter(
				'preservationMode',
				i,
				'',
			) as string;
			const targetAudience = this.getNodeParameter(
				'targetAudience',
				i,
				'',
			) as string;
			const tone = this.getNodeParameter('tone', i, '') as string;
			const callbackUrl = this.getNodeParameter('callbackUrl', i, '') as string;
			if (callbackUrl && !/^https:\/\//i.test(callbackUrl.trim())) {
				throw new NodeOperationError(
					this.getNode(),
					'Callback URL must start with https://. Plain http:// is not accepted because the API posts results to it.',
					{ itemIndex: i },
				);
			}

			const formData: Record<string, unknown> = {
				file: {
					value: buffer,
					options: {
						filename: binary.fileName ?? 'upload',
						contentType: binary.mimeType ?? 'application/octet-stream',
					},
				},
				exportType,
			};

			if (topic) formData.topic = topic;
			if (slideCount != null) formData.slideCount = String(slideCount);
			if (language) formData.language = language;
			if (domain) formData.domain = domain;
			// Server reads `instruction` form field for /document/file (per the
			// Presentations.AI api-client). Send both the user-visible value
			// (preservationMode) and the canonical server field so behavior matches
			// the documented MCP tool spec without depending on which one the
			// REST layer happens to read.
			if (preservationMode) {
				formData.preservationMode = preservationMode;
				formData.instruction = preservationMode;
			}
			if (targetAudience) {
				// /document/file form uses camelCase `targetAudience` per api-client.
				formData.targetAudience = targetAudience;
			}
			if (tone) formData.tone = tone;
			if (callbackUrl) formData.callback_url = callbackUrl;

			const options: IHttpRequestOptions = {
				method: 'POST',
				url: `${baseUrl}${FILE_ENDPOINT}`,
				body: formData,
				returnFullResponse: false,
				json: false,
			};

			const response = await this.helpers.httpRequestWithAuthentication.call(
				this,
				CREDENTIAL_NAME,
				options,
			);

			let parsed: IDataObject;
			if (typeof response === 'string') {
				try {
					const decoded = JSON.parse(response) as unknown;
					parsed =
						decoded && typeof decoded === 'object' && !Array.isArray(decoded)
							? (decoded as IDataObject)
							: { value: decoded as IDataObject[keyof IDataObject] };
				} catch {
					parsed = { raw: response };
				}
			} else if (response && typeof response === 'object') {
				parsed = response as IDataObject;
			} else {
				parsed = { value: response as IDataObject[keyof IDataObject] };
			}

			returnData.push({
				json: parsed,
				pairedItem: { item: i },
			});
		} catch (error) {
			const message = extractApiErrorMessage(error);
			if (this.continueOnFail()) {
				returnData.push({
					json: { error: message ?? (error as Error).message },
					pairedItem: { item: i },
				});
				continue;
			}
			if (error instanceof NodeOperationError) {
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				throw error;
			}
			throw new NodeApiError(
				this.getNode(),
				{ message: message ?? (error as Error).message },
				{ itemIndex: i },
			);
		}
	}

	return [returnData];
}
