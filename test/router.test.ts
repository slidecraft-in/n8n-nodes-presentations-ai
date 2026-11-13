import type { IExecuteFunctions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { router } from '../nodes/PresentationsAi/actions/router';

// Get Status with an empty ID fails before any API call, which makes it a
// simple way to drive the error path.
function context(continueOnFail: boolean) {
	return {
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name: string) =>
			({ resource: 'job', operation: 'checkStatus', jobId: '' })[name as 'resource'],
		getNode: () => ({ name: 'Presentations.AI', type: 'x', typeVersion: 1 }),
		continueOnFail: () => continueOnFail,
		getExecutionCancelSignal: () => undefined,
		addExecutionHints: () => {},
	} as unknown as IExecuteFunctions;
}

describe('router error handling', () => {
	it('marks continue-on-fail items as errors so n8n routes them to the error output', async () => {
		const [items] = await router.call(context(true));
		expect(items).toHaveLength(1);
		expect(items[0].error).toBeDefined();
		expect(items[0].json.error).toBe("The 'Request ID or Status URL' parameter is empty");
		expect(items[0].pairedItem).toEqual({ item: 0 });
	});

	it('throws when the node is not set to continue on fail', async () => {
		await expect(router.call(context(false))).rejects.toThrow(
			"The 'Request ID or Status URL' parameter is empty",
		);
	});
});
