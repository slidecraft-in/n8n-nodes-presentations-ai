import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import { listBrandKits } from '../../transport';
import type { BrandKit } from '../../types';

// The API returns at most 100 brand kits per page.
const API_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;
const BRAND_KIT_TYPES = ['CATALOG', 'PERSONAL', 'WORKSPACE'];

const properties: INodeProperties[] = [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		options: [
			{
				displayName: 'Domain',
				name: 'domain',
				type: 'string',
				default: '',
				placeholder: 'e.g. example.com',
				description: 'Only brand kits for exactly this website domain',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description:
					'Only brand kits whose name or domain contains this text (up to 100 characters)',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{
						name: 'Catalog',
						value: 'CATALOG',
						description: 'Ready-made brand kits from Presentations.AI',
					},
					{ name: 'Personal', value: 'PERSONAL', description: 'Brand kits only you can use' },
					{
						name: 'Workspace',
						value: 'WORKSPACE',
						description: 'Brand kits everyone in your workspace can use',
					},
				],
				default: 'WORKSPACE',
				description: 'Only brand kits of this type',
			},
		],
	},
];

const displayOptions = { show: { resource: ['brandKit'], operation: ['getMany'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', itemIndex, 50) as number);
	const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;

	const qs: Record<string, string | number> = {};
	const search = toText(filters.search).trim();
	if (search.length > MAX_SEARCH_LENGTH) {
		throw new NodeOperationError(this.getNode(), "The 'Search' filter is too long", {
			itemIndex,
			description: `Presentations.AI searches with up to ${MAX_SEARCH_LENGTH} characters. This one has ${search.length}.`,
		});
	}
	if (search) qs.q = search;
	const domain = toText(filters.domain).trim();
	if (domain) qs.domain = domain;
	const type = toText(filters.type).trim().toUpperCase();
	if (type) {
		if (!BRAND_KIT_TYPES.includes(type)) {
			throw new NodeOperationError(
				this.getNode(),
				`'Type' must be Catalog, Personal or Workspace, not '${toText(filters.type)}'`,
				{ itemIndex },
			);
		}
		qs.type = type;
	}

	// The page size stays the same on every page, or the API's page numbers
	// would shift and repeat brand kits.
	const pageSize = Math.min(API_PAGE_SIZE, limit);
	const brandKits: BrandKit[] = [];
	for (let page = 1; brandKits.length < limit; page++) {
		const response = await listBrandKits.call(this, { ...qs, page, limit: pageSize });
		brandKits.push(...response.data);
		if (response.data.length < pageSize || page * pageSize >= response.total) break;
	}

	return brandKits.slice(0, limit).map((brandKit) => ({
		json: brandKit,
		pairedItem: { item: itemIndex },
	}));
}
