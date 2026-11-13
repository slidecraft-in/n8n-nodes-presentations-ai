import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toVisibility } from '../../helpers/deckBody';
import { locatorValue, simplifyDeck, toText } from '../../helpers/utils';
import { updateDeck } from '../../transport';
import { readDeckId } from './common';
import {
	presentationLocatorField,
	projectLocator,
	simplifyField,
	visibilityUpdateOption,
} from './fields';

const properties: INodeProperties[] = [
	presentationLocatorField,
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'New name of the presentation in Presentations.AI',
			},
			projectLocator('projectId', 'Project to move the presentation to'),
			visibilityUpdateOption,
		],
	},
	simplifyField,
];

const displayOptions = { show: { resource: ['presentation'], operation: ['update'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	const fields = this.getNodeParameter('updateFields', itemIndex, {}) as IDataObject;

	const body: IDataObject = {};
	const name = toText(fields.name).trim();
	if (name) body.name = name;
	const projectId = locatorValue(fields.projectId);
	if (projectId) body.project_id = projectId;
	const visibility = toVisibility(toText(fields.visibility));
	if (visibility) body.visibility = visibility;

	if (Object.keys(body).length === 0) {
		throw new NodeOperationError(this.getNode(), 'Nothing to update', {
			itemIndex,
			description: "Add a field under 'Update Fields' and give it a value.",
		});
	}

	const deck = await updateDeck.call(this, deckId, body);
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;
	return [{ json: simplify ? simplifyDeck(deck) : deck, pairedItem: { item: itemIndex } }];
}
