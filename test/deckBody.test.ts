import { describe, expect, it } from 'vitest';

import {
	buildDeckRequest,
	toAudience,
	toExportFormat,
	toLanguageName,
} from '../nodes/PresentationsAi/helpers/deckBody';

describe('buildDeckRequest', () => {
	it('maps a topic deck onto the API body', () => {
		expect(
			buildDeckRequest({
				topic: '  Q3 launch plan  ',
				slideCount: 12,
				exportType: 'pdf',
				targetAudience: 'executive-leadership',
				language: 'es',
				domain: 'example.com',
			}),
		).toEqual({
			prompt: 'Q3 launch plan',
			slide_count: '12',
			export_format: 'PDF',
			audience: 'Executive leadership',
			language: 'Spanish',
			company_domain: 'example.com',
		});
	});

	it('sends content as a text source and preservation mode as fidelity', () => {
		const body = buildDeckRequest({
			content: 'Meeting notes',
			preservationMode: 'summarize',
			slideCount: 5,
		});
		expect(body.sources).toEqual([{ type: 'text', content: 'Meeting notes' }]);
		expect(body.fidelity).toBe('condense');
		expect(body.slide_count).toBe('5');
		expect(body.prompt).toBeUndefined();
	});

	it('lets the source decide the slide count in preserve mode', () => {
		const body = buildDeckRequest({ content: 'x', preservationMode: 'preserve', slideCount: 10 });
		expect(body.fidelity).toBe('retain');
		expect(body.slide_count).toBeUndefined();
	});

	it('leaves fidelity to the server in instruction mode', () => {
		const body = buildDeckRequest({
			content: 'x',
			topic: 'Only the pricing',
			preservationMode: 'instruction',
		});
		expect(body.fidelity).toBeUndefined();
		expect(body.prompt).toBe('Only the pricing');
	});

	it('maps enhance to context', () => {
		expect(buildDeckRequest({ content: 'x', preservationMode: 'enhance' }).fidelity).toBe(
			'context',
		);
	});

	it('requests one slide for a single slide', () => {
		expect(buildDeckRequest({ topic: 't', singleSlide: true, slideCount: 10 }).slide_count).toBe(
			'1',
		);
	});

	it('omits invalid or empty slide counts', () => {
		expect(buildDeckRequest({ topic: 't', slideCount: 0 }).slide_count).toBeUndefined();
		expect(buildDeckRequest({ topic: 't', slideCount: Number.NaN }).slide_count).toBeUndefined();
		expect(buildDeckRequest({ topic: 't', slideCount: 7.4 }).slide_count).toBe('7');
		expect(buildDeckRequest({ topic: 't', slideCount: 0.4 }).slide_count).toBeUndefined();
	});

	it('maps options and drops empty strings', () => {
		const body = buildDeckRequest({
			topic: 't',
			domain: '  ',
			deckTitle: 'Board update',
			model: 'pro',
			levelOfDetail: 'very_detailed',
			speakerNotes: true,
			brandKitId: ' 2f1c ',
		});
		expect(body).toMatchObject({
			deck_title: 'Board update',
			model: 'PRO',
			level_of_detail: 'VERY_DETAILED',
			speaker_notes: true,
			brand_kit_id: '2f1c',
		});
		expect(body).not.toHaveProperty('company_domain');
	});

	it('sends the project when one is set', () => {
		expect(buildDeckRequest({ topic: 't', projectId: ' p1 ' }).project_id).toBe('p1');
		expect(buildDeckRequest({ topic: 't', projectId: '' })).not.toHaveProperty('project_id');
	});

	it('never sends fields the API does not accept', () => {
		const allowed = new Set([
			'prompt',
			'sources',
			'deck_title',
			'language',
			'slide_count',
			'export_format',
			'audience',
			'company_domain',
			'fidelity',
			'model',
			'level_of_detail',
			'speaker_notes',
			'brand_kit_id',
		]);
		const body = buildDeckRequest({
			topic: 't',
			content: 'c',
			slideCount: 3,
			exportType: 'pptx',
			targetAudience: 'technical-team',
			language: 'en',
			domain: 'example.com',
			preservationMode: 'enhance',
			deckTitle: 'd',
			model: 'STANDARD',
			levelOfDetail: 'BRIEF',
			speakerNotes: true,
			brandKitId: 'b',
		});
		for (const key of Object.keys(body)) expect(allowed.has(key)).toBe(true);
	});
});

describe('toExportFormat', () => {
	it.each([
		['pptx', 'PPTX'],
		['pdf', 'PDF'],
		['image', 'IMAGE'],
		['PDF', 'PDF'],
		// Values from earlier versions of the node
		['ppt', 'PPTX'],
		['render', 'PPTX'],
		['share', 'PPTX'],
		[undefined, 'PPTX'],
	])('%s -> %s', (input, expected) => {
		expect(toExportFormat(input)).toBe(expected);
	});
});

describe('toAudience', () => {
	it('turns option values into readable labels', () => {
		expect(toAudience('clients-customers')).toBe('Clients and customers');
	});
	it('passes free text through', () => {
		expect(toAudience('Series A investors')).toBe('Series A investors');
	});
	it('omits empty values', () => {
		expect(toAudience('  ')).toBeUndefined();
	});
	it('leaves the audience to the API for auto', () => {
		expect(toAudience('auto')).toBeUndefined();
		expect(buildDeckRequest({ topic: 't', targetAudience: 'auto' })).not.toHaveProperty('audience');
	});
});

describe('toLanguageName', () => {
	it.each([
		['en', 'English'],
		['es', 'Spanish'],
		['hi', 'Hindi'],
		['German', 'German'],
		['en_US', 'American English'],
		['pt-BR', 'Brazilian Portuguese'],
		['auto', 'auto'],
		['', undefined],
	])('%s -> %s', (input, expected) => {
		expect(toLanguageName(input)).toBe(expected);
	});
});
