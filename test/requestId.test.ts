import { describe, expect, it } from 'vitest';

import { buildRequestId, isValidRequestId } from '../nodes/PresentationsAi/helpers/requestId';

const base = {
	instanceId: 'instance-a',
	workflowId: 'wf1',
	executionId: '1234',
	nodeId: '7b2c9f1e-4a5d-4c1b-9e8f-0a1b2c3d4e5f',
	runIndex: 0,
	itemIndex: 0,
};

describe('buildRequestId', () => {
	it('matches the API pattern', () => {
		expect(isValidRequestId(buildRequestId(base))).toBe(true);
	});
	it('is stable for a retry of the same run and item', () => {
		expect(buildRequestId(base)).toBe(buildRequestId({ ...base }));
	});
	it('differs per item and per loop pass, even with identical inputs', () => {
		const id = buildRequestId(base);
		expect(buildRequestId({ ...base, itemIndex: 1 })).not.toBe(id);
		expect(buildRequestId({ ...base, runIndex: 1 })).not.toBe(id);
	});
	it('differs across executions, workflows and n8n instances', () => {
		const id = buildRequestId(base);
		expect(buildRequestId({ ...base, executionId: '1235' })).not.toBe(id);
		expect(buildRequestId({ ...base, workflowId: 'wf2' })).not.toBe(id);
		// Same execution number and node ID on another instance, e.g. an imported workflow
		expect(buildRequestId({ ...base, instanceId: 'instance-b' })).not.toBe(id);
	});
	it('falls back to a random ID when there is no execution ID', () => {
		const first = buildRequestId({ ...base, executionId: '' });
		const second = buildRequestId({ ...base, executionId: undefined });
		expect(isValidRequestId(first)).toBe(true);
		expect(first).not.toBe(second);
	});
});

describe('isValidRequestId', () => {
	it.each([
		['abc', true],
		['A1._:~-', true],
		['-abc', false],
		['has space', false],
		['', false],
		['a'.repeat(256), false],
	])('%s -> %s', (input, expected) => {
		expect(isValidRequestId(input)).toBe(expected);
	});
});
