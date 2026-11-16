import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import { createGrant } from '../../transport';
import { readDeckId } from '../presentation/common';
import { presentationLocatorField } from '../presentation/fields';
import { readRole, roleField } from './common';

export const GRANT_NOTICE =
	'No email is sent; the person can open it once that email belongs to a verified Presentations.AI user. Granting again replaces the role.';

const properties: INodeProperties[] = [
	presentationLocatorField,
	{
		displayName: 'Person',
		name: 'subject',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'e.g. name@example.com',
		description: 'Email address or Presentations.AI user ID of the person to share with',
	},
	roleField,
	{
		displayName: GRANT_NOTICE,
		name: 'grantNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = { show: { resource: ['access'], operation: ['grant'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const deckId = readDeckId.call(this, itemIndex);
	const subject = toText(this.getNodeParameter('subject', itemIndex, '')).trim();
	if (!subject) {
		throw new NodeOperationError(this.getNode(), "The 'Person' parameter is empty", {
			itemIndex,
			description:
				'Enter the email address or Presentations.AI user ID of the person to share with.',
		});
	}
	const role = readRole.call(this, itemIndex);
	const grant = await createGrant.call(this, deckId, { subject, role });
	return [{ json: grant, pairedItem: { item: itemIndex } }];
}
