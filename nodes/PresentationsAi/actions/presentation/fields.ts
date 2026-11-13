import type { INodeProperties } from 'n8n-workflow';

// Parameter names match earlier versions of this node so saved workflows keep
// their values. They are mapped onto the API body in helpers/deckBody.ts.

export const DEFAULT_MAX_WAIT_SECONDS = 600;
// File types POST /files accepts, up to 150 MB each.
export const SUPPORTED_FILE_TYPES =
	'PDF, Word (.docx), PowerPoint (.pptx), Excel (.xls, .xlsx), CSV, TSV, text, Markdown, HTML, JSON, EPUB, PNG or JPEG';
export const MAX_WAIT_SECONDS = 3600;

export const topicField: INodeProperties = {
	displayName: 'Topic',
	name: 'topic',
	type: 'string',
	typeOptions: { rows: 3 },
	required: true,
	default: '',
	placeholder: 'e.g. Q3 product launch plan for the sales team',
	description:
		'What the presentation is about. Add any instructions here too, such as what to emphasise or how to structure it.',
};

export const optionalTopicField: INodeProperties = {
	displayName: 'Topic or Instructions',
	name: 'topic',
	type: 'string',
	typeOptions: { rows: 2 },
	default: '',
	placeholder: 'e.g. Focus on the pricing changes',
	description:
		"Optional title, focus or instructions for turning the source into slides. Required when 'Preservation Mode' is 'Instruction'.",
};

export const slideCountField: INodeProperties = {
	displayName: 'Slide Count',
	name: 'slideCount',
	type: 'number',
	typeOptions: { minValue: 1, maxValue: 50 },
	default: 10,
	description:
		"Number of slides including the cover (1–50). Credits are charged per slide. Ignored when 'Preservation Mode' is 'Preserve', where the source decides.",
};

export const preservationModeField: INodeProperties = {
	displayName: 'Preservation Mode',
	name: 'preservationMode',
	type: 'options',
	options: [
		{
			name: 'Enhance',
			value: 'enhance',
			description: 'Build a new, fuller presentation that uses the source as context',
		},
		{
			name: 'Instruction',
			value: 'instruction',
			description: "Follow the 'Topic or Instructions' field to decide how the source is used",
		},
		{
			name: 'Preserve',
			value: 'preserve',
			description: 'Keep the structure of the source; it decides the slide count',
		},
		{
			name: 'Summarize',
			value: 'summarize',
			description: 'Keep the sections of the source and tighten them into key slides',
		},
	],
	default: 'enhance',
	description: 'How closely the presentation follows the source material',
};

const exportTypeField: INodeProperties = {
	displayName: 'Export Format',
	name: 'exportType',
	type: 'options',
	options: [
		{ name: 'Image', value: 'image', description: 'A ZIP file with one image per slide' },
		{ name: 'PDF', value: 'pdf', description: 'Best for sharing and printing' },
		{
			name: 'PPTX',
			value: 'pptx',
			description: 'Editable in PowerPoint, Keynote and Google Slides',
		},
	],
	default: 'pptx',
	description: 'File format of the finished presentation',
	displayOptions: { show: { '@version': [1, 2] } },
};

// Version 3 defaults to PDF, which uses the fewest credits. Versions 1 and 2
// keep PPTX, because n8n doesn't save a value left at its default.
const exportTypeFieldV3: INodeProperties = {
	...exportTypeField,
	default: 'pdf',
	description:
		'File format of the finished presentation. PPTX adds 5 credits a slide on plans without PowerPoint export.',
	displayOptions: { show: { '@version': [{ _cnd: { gte: 3 } }] } },
};

const targetAudienceField: INodeProperties = {
	displayName: 'Target Audience',
	name: 'targetAudience',
	type: 'options',
	options: [
		{
			name: 'Auto',
			value: 'auto',
			description: 'Let Presentations.AI work out the audience from the topic and content',
		},
		{ name: 'Clients / Customers', value: 'clients-customers' },
		{ name: 'Executive Leadership', value: 'executive-leadership' },
		{ name: 'General Audience', value: 'general-audience' },
		{ name: 'General Employees', value: 'general-employees' },
		{ name: 'Students / Trainees', value: 'students-trainees' },
		{ name: 'Technical Team', value: 'technical-team' },
	],
	default: 'auto',
	description:
		"Who the presentation is for. Shapes depth, wording and examples. An expression can pass any short description instead, such as 'Series A investors'.",
	hint: "Defaults to 'Auto', which works out the audience from the topic and content",
};

// n8n doesn't save parameters left at their default, so a new default would
// change saved workflows. Version 1 keeps English; version 2 follows the input.
const languageField: INodeProperties = {
	displayName: 'Language',
	name: 'language',
	type: 'string',
	default: 'English',
	placeholder: 'e.g. Spanish',
	description:
		"Language of the slides as an English name, such as English, Spanish or Japanese. Use 'auto' to match the source. Two-letter codes such as 'es' also work.",
	displayOptions: { show: { '@version': [1] } },
};

const languageFieldV2: INodeProperties = {
	displayName: 'Language',
	name: 'language',
	type: 'string',
	default: 'auto',
	placeholder: 'e.g. Spanish',
	description:
		"Language of the slides. 'auto' follows the language of the topic, text or file. To choose one, enter its English name, such as Spanish or Japanese, or a two-letter code such as 'es'.",
	displayOptions: { show: { '@version': [{ _cnd: { gte: 2 } }] } },
};

const versionOneNotice: INodeProperties = {
	displayName:
		"This is version 1 of the node: presentations are visible to your whole Presentations.AI workspace. To choose 'Visibility', add a new Presentations.AI node from the panel",
	name: 'versionOneNotice',
	type: 'notice',
	default: '',
	displayOptions: { show: { '@version': [1] } },
};

const visibilityField: INodeProperties = {
	displayName: 'Visibility',
	name: 'visibility',
	type: 'options',
	options: [
		{
			name: 'Private',
			value: 'private',
			description: "Only the API key's owner and people they invite in Presentations.AI",
		},
		{
			name: 'Project',
			value: 'project',
			description:
				"Members of the project chosen in 'Project' under 'Options', or of the project your API key is limited to",
		},
		{
			name: 'Workspace',
			value: 'workspace',
			description: "Everyone in the API key's workspace",
		},
	],
	default: 'private',
	description:
		"Who can open the presentation in Presentations.AI. Members of the project it's created in can always open it. Turning on 'Create Share Link' changes this to Public.",
	displayOptions: { show: { '@version': [{ _cnd: { gte: 2 } }] } },
};

const domainField: INodeProperties = {
	displayName: 'Company Domain',
	name: 'domain',
	type: 'string',
	default: '',
	placeholder: 'e.g. example.com',
	description:
		'Website domain of the company the presentation is about. Used for research and to match the company’s branding.',
};

const waitForCompletionField: INodeProperties = {
	displayName: 'Wait for Completion',
	name: 'waitForCompletion',
	type: 'boolean',
	default: true,
	description:
		"Whether to wait until the presentation is ready before continuing. If off, the node returns straight away with a request ID to check later with 'Job' → 'Get Status'.",
};

const maxWaitSecondsField: INodeProperties = {
	displayName: 'Max Wait (Seconds)',
	name: 'maxWaitSeconds',
	type: 'number',
	typeOptions: { minValue: 1, maxValue: MAX_WAIT_SECONDS },
	default: DEFAULT_MAX_WAIT_SECONDS,
	description:
		"Longest time to wait. If the presentation is not ready by then, the node returns its status as RUNNING so a later 'Get Status' can pick it up. A 10-slide presentation usually takes 2–4 minutes.",
	displayOptions: { show: { waitForCompletion: [true] } },
};

const downloadFileField: INodeProperties = {
	displayName: 'Download File',
	name: 'downloadFile',
	type: 'boolean',
	default: true,
	description: 'Whether to download the finished presentation into the binary data of the item',
	// Hidden for AI Agent tool calls, which drop binary output.
	displayOptions: { show: { waitForCompletion: [true], '@tool': [false] } },
};

const createShareLinkField: INodeProperties = {
	displayName: 'Create Share Link',
	name: 'createShareLink',
	type: 'boolean',
	default: false,
	description:
		"Whether to create a share link once the presentation is ready. This makes the presentation public, whatever 'Visibility' says: anyone with the link and everyone in your workspace can view it.",
	displayOptions: { show: { waitForCompletion: [true] } },
};

const shareLinkNotice: INodeProperties = {
	displayName:
		"A share link makes the presentation public, whatever 'Visibility' says: anyone with the link and everyone in your workspace can view it. Deleting the link later leaves it visible to your workspace",
	name: 'shareLinkNotice',
	type: 'notice',
	default: '',
	displayOptions: { show: { waitForCompletion: [true], createShareLink: [true] } },
};

export const simplifyField: INodeProperties = {
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: true,
	description: 'Whether to return a simplified version of the response instead of the raw data',
};

export const outputBinaryFieldOption: INodeProperties = {
	displayName: 'Put Output File in Field',
	name: 'outputBinaryField',
	type: 'string',
	default: 'data',
	description: 'Name of the binary field to put the downloaded presentation in',
};

const UUID_PATTERN = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';

export const presentationLocatorField: INodeProperties = {
	displayName: 'Presentation',
	name: 'presentation',
	type: 'resourceLocator',
	required: true,
	default: { mode: 'list', value: '' },
	description: 'The presentation to use',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: { searchListMethod: 'searchPresentations', searchable: true },
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. {{ $json.deck_id }}',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: `^${UUID_PATTERN}$`,
						errorMessage: 'Enter a presentation ID like 2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90',
					},
				},
			],
		},
		{
			displayName: 'By URL',
			name: 'url',
			type: 'string',
			placeholder: 'e.g. {{ $json.deck_url }}',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: `^https?://.*${UUID_PATTERN}.*$`,
						errorMessage: "Enter the presentation's deck_url, or its address in your browser",
					},
				},
			],
			extractValue: { type: 'regex', regex: `.*(${UUID_PATTERN})` },
		},
	],
};

export function projectLocator(name: string, description: string): INodeProperties {
	return {
		displayName: 'Project',
		name,
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description,
		hint: "The list needs an API key with the 'projects:read' scope. Otherwise switch to 'By ID'.",
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchProjects', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 7c9e6679-7425-40de-944b-e07fc1f90ae7',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: `^${UUID_PATTERN}$`,
							errorMessage: 'Enter an ID like 2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90',
						},
					},
				],
			},
		],
	};
}

// Who can open a presentation, for Update. Public comes only from a share link.
export const visibilityUpdateOption: INodeProperties = {
	displayName: 'Visibility',
	name: 'visibility',
	type: 'options',
	options: [
		{
			name: 'Private',
			value: 'private',
			description: "Only the API key's owner and people they invite in Presentations.AI",
		},
		{
			name: 'Project',
			value: 'project',
			description: "Members of the presentation's project",
		},
		{
			name: 'Workspace',
			value: 'workspace',
			description: "Everyone in the API key's workspace",
		},
	],
	default: 'private',
	description:
		"Who can open the presentation in Presentations.AI. Members of its project can always open it. This doesn't remove a share link: if the presentation has one ('has_share_link'), anyone with the link can still open it.",
};

const createOptionsField: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add Option',
	default: {},
	options: [
		{
			displayName: 'Allowed Graphics',
			name: 'allowedGraphics',
			type: 'string',
			default: '',
			placeholder: 'e.g. table, list, diagram',
			description:
				'Comma-separated graphic types the slides may use. Other graphics are redrawn as the closest allowed type. Leave empty to allow all.',
		},
		{
			displayName: 'Brand Kit',
			name: 'brandKitId',
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			description: 'Brand to style the presentation with: its fonts, colours and logo',
			hint: "The list needs an API key with the 'brand_kits:read' scope. Otherwise switch to 'By ID'.",
			modes: [
				{
					displayName: 'From List',
					name: 'list',
					type: 'list',
					typeOptions: { searchListMethod: 'searchBrandKits', searchable: true },
				},
				{
					displayName: 'By ID',
					name: 'id',
					type: 'string',
					placeholder: 'e.g. 2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90',
					validation: [
						{
							type: 'regex',
							properties: {
								regex:
									'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
								errorMessage: 'Enter an ID like 2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90',
							},
						},
					],
				},
			],
		},
		{
			displayName: 'Company',
			name: 'company',
			type: 'string',
			default: '',
			description:
				'Company the presentation is about. Presentations.AI researches it instead of guessing it from the topic.',
		},
		{
			displayName: 'Deep Research',
			name: 'deepResearch',
			type: 'boolean',
			default: false,
			description:
				"Whether to add consultant-grade research and exhibit slides. Paid plans only. Doubles the presentation's credits per slide. Not used with 'Create From Outline'.",
		},
		{
			displayName: 'Delivery',
			name: 'delivery',
			type: 'options',
			options: [
				{ name: 'Auto', value: 'auto', description: 'Presentations.AI decides' },
				{ name: 'Meeting', value: 'meeting' },
				{ name: 'Print', value: 'print' },
				{ name: 'Read', value: 'read', description: 'Sent and read alone' },
				{ name: 'Stage', value: 'stage', description: 'Shown on a big screen' },
				{ name: 'Video', value: 'video', description: 'Shown on a call' },
			],
			default: 'auto',
			description: 'How the presentation will be shown. Sets how many words go on each slide.',
		},
		{
			displayName: 'Insider Content',
			name: 'insiderContent',
			type: 'string',
			typeOptions: { rows: 4 },
			default: '',
			description:
				"Private facts about your organisation, used where a slide needs them and never cited. Counts toward your plan's content limit.",
		},
		{
			displayName: 'Level of Detail',
			name: 'levelOfDetail',
			type: 'options',
			options: [
				{ name: 'Brief', value: 'BRIEF' },
				{ name: 'Detailed', value: 'DETAILED' },
				{ name: 'Standard', value: 'STANDARD' },
				{ name: 'Very Detailed', value: 'VERY_DETAILED' },
			],
			default: 'STANDARD',
			description: 'How much text goes on each slide',
		},
		{
			displayName: 'Missing Figures',
			name: 'missingFigures',
			type: 'options',
			options: [
				{
					name: 'Auto',
					value: 'auto',
					description:
						"Follows your topic or instructions (for example 'use only my numbers'), otherwise estimates",
				},
				{
					name: 'Estimate',
					value: 'estimate',
					description: "Writes a plausible estimate, marked as one in the outline's figure check",
				},
				{
					name: 'Placeholder',
					value: 'placeholder',
					description: 'Leaves a [DATA NEEDED: …] marker on the slide',
				},
			],
			default: 'auto',
			description: 'What to do when a slide needs a figure that only you have and nobody gave',
		},
		{
			displayName: 'Model',
			name: 'model',
			type: 'options',
			options: [
				{ name: 'Pro', value: 'PRO' },
				{ name: 'Standard', value: 'STANDARD' },
				{ name: 'Ultra', value: 'ULTRA' },
			],
			default: 'STANDARD',
			description:
				'Generation model tier. Tiers above what your plan includes are rejected by the API.',
		},
		{
			displayName: 'Name',
			name: 'name',
			type: 'string',
			default: '',
			description:
				"Name of the presentation in your Presentations.AI workspace. Leave empty to use 'Presentation Title' or the generated title.",
		},
		{
			displayName: 'Presentation Title',
			name: 'deckTitle',
			type: 'string',
			default: '',
			description: 'Title for the presentation. Also names the downloaded file.',
		},
		{
			displayName: 'Project',
			name: 'projectId',
			type: 'resourceLocator',
			default: { mode: 'list', value: '' },
			description:
				'Project to create the presentation in. Leave empty to use the project your API key is limited to, or the workspace if it has none.',
			hint: "The list needs an API key with the 'projects:read' scope. Otherwise switch to 'By ID'.",
			modes: [
				{
					displayName: 'From List',
					name: 'list',
					type: 'list',
					typeOptions: { searchListMethod: 'searchProjects', searchable: true },
				},
				{
					displayName: 'By ID',
					name: 'id',
					type: 'string',
					placeholder: 'e.g. 7c9e6679-7425-40de-944b-e07fc1f90ae7',
					validation: [
						{
							type: 'regex',
							properties: {
								regex:
									'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
								errorMessage: 'Enter an ID like 2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90',
							},
						},
					],
				},
			],
		},
		{
			displayName: 'Purpose',
			name: 'purpose',
			type: 'options',
			options: [
				{
					name: 'Auto',
					value: 'auto',
					description: 'Presentations.AI decides from the topic and sources',
				},
				{ name: 'Coursework', value: 'coursework' },
				{ name: 'General', value: 'general' },
				{ name: 'Marketing', value: 'marketing' },
				{ name: 'Pitch', value: 'pitch' },
				{ name: 'Product', value: 'product' },
				{ name: 'Report', value: 'report' },
				{ name: 'Research', value: 'research' },
				{ name: 'Sales', value: 'sales' },
				{ name: 'Security', value: 'security' },
				{ name: 'Strategy', value: 'strategy' },
				{ name: 'Teaching', value: 'teaching' },
				{ name: 'Training', value: 'training' },
			],
			default: 'auto',
			description: 'What the presentation is for',
		},
		outputBinaryFieldOption,
		{
			displayName: 'Quality Tier',
			name: 'qualityTier',
			type: 'options',
			options: [
				{ name: 'Lite', value: 'lite' },
				{ name: 'Premium', value: 'premium' },
				{ name: 'Standard', value: 'standard' },
			],
			default: 'standard',
			description: 'Each tier is billed at its own rate per slide. Standard is the default.',
		},
		{
			displayName: 'Request ID',
			name: 'requestId',
			type: 'string',
			default: '',
			description:
				"Your own ID for this request. Sending the same ID with the same inputs returns the original presentation instead of creating a new one. For 'Create From File', an existing request with this ID is reused without uploading the file again. Leave empty to have one generated per node run and item.",
		},
		{
			displayName: 'Speaker Notes',
			name: 'speakerNotes',
			type: 'boolean',
			default: false,
			description: 'Whether to write presenter notes for every slide',
		},
	],
};

// Fields every create operation shares, in display order.
export const commonCreateFields: INodeProperties[] = [
	exportTypeField,
	exportTypeFieldV3,
	targetAudienceField,
	languageField,
	languageFieldV2,
	domainField,
	versionOneNotice,
	visibilityField,
	waitForCompletionField,
	maxWaitSecondsField,
	downloadFileField,
	createShareLinkField,
	shareLinkNotice,
	simplifyField,
	createOptionsField,
];
