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

const CREATE_OPERATIONS = ['createFromTopic', 'createFromContent', 'createFromFile', 'createSingleSlide'];

describe('node versions', () => {
	it('offers versions 1 and 2, with 2 for new nodes', () => {
		expect(description.version).toEqual([1, 2]);
		expect(description.defaultVersion).toBe(2);
	});

	it.each(CREATE_OPERATIONS)('version 1 %s keeps English and has no Visibility', (operation) => {
		const params = defaultsFor(1, operation);
		expect(params?.language).toBe('English');
		expect(params).not.toHaveProperty('visibility');
	});

	it.each(CREATE_OPERATIONS)('version 2 %s defaults to auto and Private', (operation) => {
		const params = defaultsFor(2, operation);
		expect(params?.language).toBe('auto');
		expect(params?.visibility).toBe('private');
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
