import type { IDataObject } from 'n8n-workflow';

// Shapes from the Presentations.AI REST API (https://api.presentations.ai/api/v1/openapi.json).
// Declared as type aliases so responses can be returned as item JSON directly.

export type AsyncTaskStatus = 'CREATED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type GenerationStage = 'QUEUED' | 'OUTLINE' | 'SLIDES' | 'EXPORT' | 'COMPLETED' | 'FAILED';

export type DeckExportFormat = 'PPTX' | 'PDF' | 'IMAGE';

export type DeckFidelity = 'retain' | 'condense' | 'context';

export type DeckModel = 'STANDARD' | 'PRO' | 'ULTRA';

export type DeckLevelOfDetail = 'BRIEF' | 'STANDARD' | 'DETAILED' | 'VERY_DETAILED';

// PUBLIC is left out: the node makes a deck public only through Create Share Link.
export type DeckVisibility = 'PRIVATE' | 'WORKSPACE' | 'PROJECT';

export type TextSource = { type: 'text'; content: string };

export type FileSource = { type: 'file'; file_id: string };

export type DeckSource = TextSource | FileSource;

export type CreateDeckRequest = {
	prompt?: string;
	sources?: DeckSource[];
	deck_title?: string;
	language?: string;
	slide_count?: string;
	export_format?: DeckExportFormat;
	audience?: string;
	company_domain?: string;
	fidelity?: DeckFidelity;
	model?: DeckModel;
	level_of_detail?: DeckLevelOfDetail;
	speaker_notes?: boolean;
	brand_kit_id?: string;
	project_id?: string;
	visibility?: DeckVisibility;
	name?: string;
	company?: string;
	insider_content?: string;
	deck_purpose?: string;
	delivery?: string;
	missing_data?: 'placeholder' | 'estimate';
	budget_tier?: 'lite' | 'standard' | 'premium';
	deep_search?: boolean;
	graphic_types?: string[];
	outline?: IDataObject;
};

export type ExternalDeckExportResponse = {
	id: string;
	deck_id: string;
	format: DeckExportFormat;
	content_type: string;
	size_bytes: number;
	download_url: string;
	created_at: string;
};

export type GeneratedDeckResponse = {
	request_id: string;
	deck_id: string;
	status: AsyncTaskStatus;
	stage: GenerationStage;
	status_url: string;
	deck_url: string;
	error: string | null;
	created_at: string;
	updated_at: string;
	warnings?: IDataObject[];
	export?: ExternalDeckExportResponse | null;
};

export type ExternalFileResponse = {
	file_id: string;
	filename: string;
	// Null when no extraction task exists yet.
	status: AsyncTaskStatus | null;
	error?: string | null;
	size_bytes?: number;
	content_type?: string;
	created_at: string;
};

export type ShareLink = {
	url: string;
	password_set?: boolean;
	expires_at?: string | null;
};

export type BrandKitMatch = {
	id: string;
	name: string;
	domain?: string | null;
	type?: string;
};

export type Project = {
	id: string;
	name: string;
	kind?: string;
	archived_at?: string | null;
};

export type Page<T> = { data: T[]; page: number; limit: number; total: number };

// GET /decks list item and PATCH /decks/{id} response.
export type Deck = {
	id: string;
	workspace_id: string;
	project_id: string | null;
	created_by: string;
	name: string;
	visibility: DeckVisibility | 'PUBLIC';
	thumbnail_url?: string | null;
	deck_url?: string | null;
	has_share_link?: boolean;
	archived_at: string | null;
	created_at: string;
	updated_at: string;
	flags?: string[];
};

// GET /decks/{id}: the list fields plus generation status and exports.
export type DeckDetail = Deck & {
	status: AsyncTaskStatus;
	exports: ExternalDeckExportResponse[];
};

export type DeckSort = 'RECENT' | 'NAME' | 'UPDATED' | 'CREATED';

export type ApiErrorBody = {
	error?: {
		code?: string;
		message?: string;
		details?: IDataObject | null;
		trace_id?: string | null;
	};
};

// Node parameters that map onto CreateDeckRequest. Names match the saved
// parameter names so workflows built on earlier versions keep loading.
export type DeckInputs = {
	topic?: string;
	content?: string;
	slideCount?: number;
	singleSlide?: boolean;
	exportType?: string;
	targetAudience?: string;
	language?: string;
	domain?: string;
	preservationMode?: string;
	deckTitle?: string;
	model?: string;
	levelOfDetail?: string;
	speakerNotes?: boolean;
	brandKitId?: string;
	projectId?: string;
	visibility?: string;
	name?: string;
	company?: string;
	insiderContent?: string;
	purpose?: string;
	delivery?: string;
	missingFigures?: string;
	qualityTier?: string;
	deepResearch?: boolean;
	allowedGraphics?: string;
	outline?: IDataObject;
};
