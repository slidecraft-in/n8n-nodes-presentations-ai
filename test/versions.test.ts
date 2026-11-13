import { NodeHelpers } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { PresentationsAi } from '../nodes/PresentationsAi/PresentationsAi.node';

const { description } = new PresentationsAi();

// Resolves the parameters n8n would use for a node of this version, the same
// way the editor and runtime do.
function defaultsFor(typeVersion: number, operation: string) {
	return NodeHelpers.getNodeParameters(
		description.properties,
		{ resource: 'presentation', operation },
		true,
		false,
		{ typeVersion },
		description,
	);
}

const CREATE_OPERATIONS = [
	'createFromTopic',
	'createFromContent',
	'createFromFile',
	'createSingleSlide',
];

describe('node versions', () => {
	it('offers versions 1, 2 and 3, with 3 for new nodes', () => {
		expect(description.version).toEqual([1, 2, 3]);
		expect(description.defaultVersion).toBe(3);
	});

	it.each([
		[1, 'pptx'],
		[2, 'pptx'],
		[3, 'pdf'],
	])('version %i defaults Export Format to %s', (typeVersion, format) => {
		for (const operation of CREATE_OPERATIONS) {
			expect(defaultsFor(typeVersion, operation)?.exportType).toBe(format);
		}
	});

	it.each(CREATE_OPERATIONS)('version 1 %s keeps English and has no Visibility', (operation) => {
		const params = defaultsFor(1, operation);
		expect(params?.language).toBe('English');
		expect(params).not.toHaveProperty('visibility');
	});

	it.each(CREATE_OPERATIONS)('versions 2 and 3 %s default to auto and Private', (operation) => {
		for (const version of [2, 3]) {
			const params = defaultsFor(version, operation);
			expect(params?.language).toBe('auto');
			expect(params?.visibility).toBe('private');
		}
	});

	it('never offers public visibility', () => {
		const field = description.properties.find((p) => p.name === 'visibility');
		const values = (field?.options ?? []).map((o) => ('value' in o ? o.value : undefined));
		expect(values.sort()).toEqual(['private', 'project', 'workspace']);
	});

	it('leaves Get Status unchanged', () => {
		const v1 = NodeHelpers.getNodeParameters(
			description.properties,
			{ resource: 'job', operation: 'checkStatus' },
			true,
			false,
			{ typeVersion: 1 },
			description,
		);
		const v2 = NodeHelpers.getNodeParameters(
			description.properties,
			{ resource: 'job', operation: 'checkStatus' },
			true,
			false,
			{ typeVersion: 2 },
			description,
		);
		expect(v2).toEqual(v1);
	});
});
