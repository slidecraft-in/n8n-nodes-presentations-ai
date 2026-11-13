import type {
	CreateDeckRequest,
	DeckExportFormat,
	DeckFidelity,
	DeckInputs,
	DeckLevelOfDetail,
	DeckModel,
	DeckVisibility,
} from '../types';

const VISIBILITIES = new Set<DeckVisibility>(['PRIVATE', 'WORKSPACE', 'PROJECT']);

// Unknown values are dropped rather than sent, so the API never makes a deck
// public from this field.
export function toVisibility(value: string | undefined): DeckVisibility | undefined {
	const upper = value?.trim().toUpperCase() as DeckVisibility | undefined;
	return upper && VISIBILITIES.has(upper) ? upper : undefined;
}

// Earlier versions offered ppt, render and share. The API now exports PPTX,
// PDF or IMAGE only, so those legacy values fall back to PPTX; sharing is a
// separate "Create Share Link" step.
const EXPORT_FORMATS: Record<string, DeckExportFormat> = {
	pptx: 'PPTX',
	ppt: 'PPTX',
	render: 'PPTX',
	share: 'PPTX',
	pdf: 'PDF',
	image: 'IMAGE',
};

const FIDELITY_BY_PRESERVATION_MODE: Record<string, DeckFidelity | undefined> = {
	enhance: 'context',
	preserve: 'retain',
	summarize: 'condense',
	// The topic carries the instructions; the server picks the fidelity.
	instruction: undefined,
};

export const AUDIENCE_LABELS: Record<string, string> = {
	'clients-customers': 'Clients and customers',
	'executive-leadership': 'Executive leadership',
	'general-audience': 'General audience',
	'general-employees': 'General employees',
	'students-trainees': 'Students and trainees',
	'technical-team': 'Technical team',
};

export function toExportFormat(value: string | undefined): DeckExportFormat {
	const key = (value ?? '').trim().toLowerCase();
	return EXPORT_FORMATS[key] ?? ((key.toUpperCase() || 'PPTX') as DeckExportFormat);
}

export function toAudience(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	// "auto" sends nothing, so the API infers the audience from the prompt and sources.
	if (!trimmed || trimmed.toLowerCase() === 'auto') return undefined;
	return AUDIENCE_LABELS[trimmed] ?? trimmed;
}

// The API wants an English language name ("Spanish") or "auto". Earlier
// versions asked for ISO codes ("es"), so codes are translated.
export function toLanguageName(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) return undefined;
	if (!/^[a-z]{2,3}([-_][a-z0-9]{2,4})?$/i.test(trimmed)) return trimmed;
	try {
		const tag = trimmed.replace('_', '-');
		return new Intl.DisplayNames(['en'], { type: 'language' }).of(tag) ?? trimmed;
	} catch {
		return trimmed;
	}
}

function nonEmpty(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function toSlideCount(inputs: DeckInputs): string | undefined {
	if (inputs.singleSlide) return '1';
	// "Preserve" keeps the source's own structure, so the server sizes the deck.
	if (inputs.preservationMode === 'preserve') return undefined;
	const count = Math.round(Number(inputs.slideCount));
	if (!Number.isFinite(count) || count < 1) return undefined;
	return String(count);
}

// Maps node parameters onto the POST /decks body. File sources are added by
// the caller after the upload.
export function buildDeckRequest(inputs: DeckInputs): CreateDeckRequest {
	const body: CreateDeckRequest = {
		export_format: toExportFormat(inputs.exportType),
	};

	const prompt = nonEmpty(inputs.topic);
	if (prompt) body.prompt = prompt;

	const content = nonEmpty(inputs.content);
	if (content) body.sources = [{ type: 'text', content }];

	const slideCount = toSlideCount(inputs);
	if (slideCount) body.slide_count = slideCount;

	const fidelity = inputs.preservationMode
		? FIDELITY_BY_PRESERVATION_MODE[inputs.preservationMode]
		: undefined;
	if (fidelity) body.fidelity = fidelity;

	const audience = toAudience(inputs.targetAudience);
	if (audience) body.audience = audience;

	const language = toLanguageName(inputs.language);
	if (language) body.language = language;

	const domain = nonEmpty(inputs.domain);
	if (domain) body.company_domain = domain;

	const deckTitle = nonEmpty(inputs.deckTitle);
	if (deckTitle) body.deck_title = deckTitle;

	if (inputs.model) body.model = inputs.model.toUpperCase() as DeckModel;
	if (inputs.levelOfDetail) {
		body.level_of_detail = inputs.levelOfDetail.toUpperCase() as DeckLevelOfDetail;
	}
	if (inputs.speakerNotes) body.speaker_notes = true;

	const brandKitId = nonEmpty(inputs.brandKitId);
	if (brandKitId) body.brand_kit_id = brandKitId;

	const projectId = nonEmpty(inputs.projectId);
	if (projectId) body.project_id = projectId;

	const visibility = toVisibility(inputs.visibility);
	if (visibility) body.visibility = visibility;

	const name = nonEmpty(inputs.name);
	if (name) body.name = name;
	const company = nonEmpty(inputs.company);
	if (company) body.company = company;
	const insider = nonEmpty(inputs.insiderContent);
	if (insider) body.insider_content = insider;

	const purpose = fromList(inputs.purpose, PURPOSES);
	if (purpose) body.deck_purpose = purpose;
	const delivery = fromList(inputs.delivery, DELIVERIES);
	if (delivery) body.delivery = delivery;
	const missing = fromList(inputs.missingFigures, MISSING_DATA);
	if (missing) body.missing_data = missing as CreateDeckRequest['missing_data'];
	// Standard is the API's default tier, so only the others are sent.
	const tier = fromList(inputs.qualityTier, QUALITY_TIERS);
	if (tier && tier !== 'standard') body.budget_tier = tier as CreateDeckRequest['budget_tier'];

	const graphics = toGraphicTypes(inputs.allowedGraphics);
	if (graphics.length) body.graphic_types = graphics;

	if (inputs.outline) {
		// An authored outline replaces the prompt and sources, and the API doesn't
		// research for it.
		body.outline = inputs.outline;
		delete body.prompt;
		delete body.sources;
		delete body.slide_count;
	} else if (inputs.deepResearch) {
		body.deep_search = true;
	}

	return body;
}

// Values from the API's descriptions of these fields.
export const PURPOSES = [
	'pitch',
	'sales',
	'marketing',
	'strategy',
	'report',
	'training',
	'teaching',
	'coursework',
	'product',
	'research',
	'security',
	'general',
];
export const DELIVERIES = ['stage', 'meeting', 'video', 'read', 'print'];
const MISSING_DATA = ['placeholder', 'estimate'];
const QUALITY_TIERS = ['lite', 'standard', 'premium'];

// "auto", empty and unknown values send nothing, so the API decides.
function fromList(value: string | undefined, allowed: string[]): string | undefined {
	const key = value?.trim().toLowerCase();
	return key && allowed.includes(key) ? key : undefined;
}

// Comma-separated graphic types, such as "table, list, diagram".
export function toGraphicTypes(value: string | undefined): string[] {
	return [
		...new Set(
			(value ?? '')
				.split(',')
				.map((part) => part.trim().toLowerCase())
				.filter(Boolean),
		),
	];
}
