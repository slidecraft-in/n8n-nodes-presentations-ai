import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { deckIdFrom } from '../../helpers/utils';

// The presentation chosen in the 'Presentation' picker: from the list, by ID,
// or by URL (its deck_url or its address in the browser).
export function readDeckId(this: IExecuteFunctions, itemIndex: number): string {
	const raw = this.getNodeParameter('presentation', itemIndex, '', { extractValue: true });
	const deckId = deckIdFrom(raw);
	if (!deckId) {
		throw new NodeOperationError(this.getNode(), "The 'Presentation' parameter is empty", {
			itemIndex,
			description:
				"Pick a presentation from the list, or map the 'deck_id' or 'deck_url' from a create operation.",
		});
	}
	return deckId;
}
