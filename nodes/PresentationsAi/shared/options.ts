import type { INodePropertyOptions } from 'n8n-workflow';

// Source of truth: docs/mcp/mcp-tools.md in the Presentations.AI Integrations repo.

export const EXPORT_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'PPTX', value: 'pptx', description: 'PowerPoint (.pptx) — editable in Microsoft PowerPoint and Google Slides' },
	{ name: 'PPT', value: 'ppt', description: 'Legacy PowerPoint format' },
	{ name: 'PDF', value: 'pdf', description: 'PDF — best for sharing and viewing' },
	{ name: 'Image', value: 'image', description: 'Static image export (one image per slide)' },
	{ name: 'Render', value: 'render', description: 'Server-rendered preview HTML' },
	{ name: 'Share Link', value: 'share', description: 'Interactive shareable web link' },
];

export const TARGET_AUDIENCE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Executive Leadership', value: 'executive-leadership' },
	{ name: 'General Employees', value: 'general-employees' },
	{ name: 'Clients / Customers', value: 'clients-customers' },
	{ name: 'Students / Trainees', value: 'students-trainees' },
	{ name: 'Technical Team', value: 'technical-team' },
	{ name: 'General Audience', value: 'general-audience' },
];

export const TONE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Professional', value: 'professional' },
	{ name: 'Conversational', value: 'conversational' },
	{ name: 'Authoritative', value: 'authoritative' },
	{ name: 'Persuasive', value: 'persuasive' },
	{ name: 'Educational', value: 'educational' },
];

export const PRESERVATION_MODE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'Enhance', value: 'enhance', description: 'Expand short content into full slides (slideCount required)' },
	{ name: 'Preserve', value: 'preserve', description: 'Keep exact content structure (auto-determines slide count)' },
	{ name: 'Summarize', value: 'summarize', description: 'Condense long content into key slides (slideCount required)' },
	{ name: 'Instruction', value: 'instruction', description: 'Use the topic field as custom transformation instructions' },
];

export const FILE_MIME_TYPE_OPTIONS: INodePropertyOptions[] = [
	{ name: 'PDF', value: 'application/pdf' },
	{ name: 'PPTX (PowerPoint .Pptx)', value: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
	{ name: 'PPT (PowerPoint Legacy)', value: 'application/vnd.ms-powerpoint' },
	{ name: 'DOCX (Word .Docx)', value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
	{ name: 'DOC (Word Legacy)', value: 'application/vnd.ms-word' },
	{ name: 'Plain Text', value: 'text/plain' },
	{ name: 'Markdown', value: 'text/markdown' },
	{ name: 'Rich Text (RTF)', value: 'application/rtf' },
];
