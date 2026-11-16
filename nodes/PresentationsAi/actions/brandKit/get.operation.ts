import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { locatorValue } from '../../helpers/utils';
import { getBrandKit } from '../../transport';

const properties: INodeProperties[] = [
	{
		displayName: 'Brand Kit',
		name: 'brandKit',
		type: 'resourceLocator',
		required: true,
		default: { mode: 'list', value: '' },
		description: 'The brand kit to get',
		hint: "The list needs an API key with the 'brand_kits:read' scope",
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'searchBrandKits', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				placeholder: 'e.g. 2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90',
				validation: [
					{
						type: 'regex',
						properties: {
							regex:
								'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
							errorMessage: 'Enter an ID like 2f1c8a4e-6b7d-4c1e-9f3a-5d2b8c7e1a90',
						},
					},
				],
			},
		],
	},
];

const displayOptions = { show: { resource: ['brandKit'], operation: ['get'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const brandKitId = locatorValue(this.getNodeParameter('brandKit', itemIndex, ''));
	if (!brandKitId) {
		throw new NodeOperationError(this.getNode(), "The 'Brand Kit' parameter is empty", {
			itemIndex,
			description: "Pick a brand kit from the list, or enter its ID under 'By ID'.",
		});
	}
	const brandKit = await getBrandKit.call(this, brandKitId);
	return [{ json: brandKit, pairedItem: { item: itemIndex } }];
}
