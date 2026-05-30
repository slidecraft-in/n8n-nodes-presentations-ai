import type { INodeProperties } from 'n8n-workflow';

import {
	EXPORT_TYPE_OPTIONS,
	PRESERVATION_MODE_OPTIONS,
	TARGET_AUDIENCE_OPTIONS,
	TONE_OPTIONS,
} from '../../shared/options';

// Operation buckets — keep in sync with operation values in resources/presentation/index.ts.
const CREATE_OPS = ['createFromTopic', 'createSingleSlide', 'createFromContent', 'createFromFile'];
const SLIDE_COUNT_OPS = ['createFromTopic', 'createFromContent', 'createFromFile'];
const TOPIC_REQUIRED_OPS = ['createFromTopic', 'createSingleSlide'];
const TOPIC_OPTIONAL_OPS = ['createFromContent', 'createFromFile'];
const CONTENT_OPS = ['createFromContent', 'createFromFile'];

const presentationShow = (operations: string[]) => ({
	show: { resource: ['presentation'], operation: operations },
});

// ─── Required input fields ──────────────────────────────────────────────────

export const topicRequiredField: INodeProperties = {
	displayName: 'Topic',
	name: 'topic',
	type: 'string',
	typeOptions: { rows: 3 },
	required: true,
	default: '',
	placeholder: 'e.g. AI in healthcare: transforming patient outcomes',
	description: 'The topic or brief for the presentation (max 500 characters)',
	displayOptions: presentationShow(TOPIC_REQUIRED_OPS),
	routing: {
		send: { type: 'body', property: 'topic' },
	},
};

export const topicOptionalField: INodeProperties = {
	displayName: 'Topic',
	name: 'topic',
	type: 'string',
	default: '',
	placeholder: 'e.g. Q3 revenue review',
	description:
		'Optional title override. When Preservation Mode is "Instruction", use this field as the custom transformation instruction (max 500 characters).',
	displayOptions: presentationShow(TOPIC_OPTIONAL_OPS),
	routing: {
		send: { type: 'body', property: 'topic' },
	},
};

export const contentField: INodeProperties = {
	displayName: 'Content',
	name: 'content',
	type: 'string',
	typeOptions: { rows: 8 },
	required: true,
	default: '',
	placeholder: 'Paste the raw text you want to transform into slides…',
	description: 'Raw text content to transform into a presentation',
	displayOptions: presentationShow(['createFromContent']),
	routing: {
		send: { type: 'body', property: 'content' },
	},
};

export const slideCountField: INodeProperties = {
	displayName: 'Slide Count',
	name: 'slideCount',
	type: 'number',
	typeOptions: { minValue: 1, maxValue: 50 },
	default: 10,
	description:
		'Number of slides to generate (1–50). Omit/ignored when Preservation Mode is "Preserve" — the slide count is then derived from the input content.',
	displayOptions: presentationShow(SLIDE_COUNT_OPS),
	routing: {
		send: { type: 'body', property: 'slideCount' },
	},
};

export const exportTypeField: INodeProperties = {
	displayName: 'Export Format',
	name: 'exportType',
	type: 'options',
	options: EXPORT_TYPE_OPTIONS,
	default: 'pptx',
	required: true,
	description: 'Output format for the generated presentation',
	displayOptions: presentationShow(CREATE_OPS),
	routing: {
		send: { type: 'body', property: 'exportType' },
	},
};

// ─── Optional input fields ──────────────────────────────────────────────────

export const targetAudienceField: INodeProperties = {
	displayName: 'Target Audience',
	name: 'targetAudience',
	type: 'options',
	options: TARGET_AUDIENCE_OPTIONS,
	default: 'general-audience',
	description: 'Who the presentation is aimed at — influences tone, depth, and examples',
	displayOptions: presentationShow(CREATE_OPS),
	routing: {
		// Server expects snake_case on JSON endpoints; createFromFile multipart sends camelCase separately.
		send: { type: 'body', property: 'target_audience' },
	},
};

export const toneField: INodeProperties = {
	displayName: 'Tone',
	name: 'tone',
	type: 'options',
	options: TONE_OPTIONS,
	default: 'professional',
	description: 'Voice and register for the slide content',
	displayOptions: presentationShow(CREATE_OPS),
	routing: {
		send: { type: 'body', property: 'tone' },
	},
};

export const preservationModeField: INodeProperties = {
	displayName: 'Preservation Mode',
	name: 'preservationMode',
	type: 'options',
	options: PRESERVATION_MODE_OPTIONS,
	default: 'enhance',
	description:
		'How to treat the input content. "Enhance" expands short content; "Summarize" condenses long content; "Preserve" keeps the structure; "Instruction" uses the Topic field as a custom transformation.',
	displayOptions: presentationShow(CONTENT_OPS),
	routing: {
		send: { type: 'body', property: 'preservationMode' },
	},
};

export const languageField: INodeProperties = {
	displayName: 'Language',
	name: 'language',
	type: 'string',
	default: 'en',
	description: 'ISO language code for the generated content (e.g. en, es, fr, de, hi)',
	displayOptions: presentationShow(CREATE_OPS),
	routing: {
		send: { type: 'body', property: 'language' },
	},
};

export const domainField: INodeProperties = {
	displayName: 'Domain',
	name: 'domain',
	type: 'string',
	default: '',
	placeholder: 'e.g. acme.com',
	description: 'Company domain — used for brand context and styling cues',
	displayOptions: presentationShow(CREATE_OPS),
	routing: {
		send: { type: 'body', property: 'domain' },
	},
};

export const callbackUrlField: INodeProperties = {
	displayName: 'Callback URL',
	name: 'callbackUrl',
	type: 'string',
	default: '',
	placeholder: 'https://your-server.com/webhook/presentations',
	description:
		'Optional HTTPS webhook. When set, the operation returns immediately with a job_id and the result is POSTed to this URL when complete. Must start with https://.',
	displayOptions: presentationShow(CREATE_OPS),
	routing: {
		send: { type: 'body', property: 'callback_url' },
	},
};

export const immediatePollUrlField: INodeProperties = {
	displayName: 'Return Job ID Immediately',
	name: 'immediatePollUrl',
	type: 'boolean',
	default: false,
	description:
		'Whether to return a job_id (and pollUrl) immediately instead of waiting for the presentation to be ready. Use Job → Check Status to poll for completion.',
	displayOptions: presentationShow(CREATE_OPS),
	routing: {
		send: { type: 'body', property: 'immediatePollUrl' },
	},
};

// ─── File-specific fields (createFromFile only) ─────────────────────────────

export const binaryPropertyField: INodeProperties = {
	displayName: 'Input Binary Field',
	name: 'binaryProperty',
	type: 'string',
	required: true,
	default: 'data',
	description: 'Name of the binary property holding the source file from the previous node (defaults to "data", which is what nodes like Read Binary File or HTTP Request produce)',
	displayOptions: presentationShow(['createFromFile']),
};

// All shared fields, composed in the resource description.
export const presentationSharedFields: INodeProperties[] = [
	topicRequiredField,
	topicOptionalField,
	contentField,
	binaryPropertyField,
	slideCountField,
	exportTypeField,
	targetAudienceField,
	toneField,
	preservationModeField,
	languageField,
	domainField,
	callbackUrlField,
	immediatePollUrlField,
];
