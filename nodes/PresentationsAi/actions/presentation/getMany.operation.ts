import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { locatorValue, simplifyDeck, toText } from '../../helpers/utils';
import { listDecks } from '../../transport';
import type { Deck } from '../../types';
import { projectLocator, simplifyField } from './fields';

// The API returns at most 200 presentations per page.
const API_PAGE_SIZE = 200;

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
			projectLocator('projectId', 'Only presentations in this project'),
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Only presentations whose name contains this text',
			},
			{
				displayName: 'Starred Only',
				name: 'starredOnly',
				type: 'boolean',
				default: false,
				description: "Whether to return only presentations starred by the API key's owner",
			},
		],
	},
	{
		displayName: 'Sort',
		name: 'sort',
		type: 'collection',
		placeholder: 'Add Sort Rule',
		default: {},
		options: [
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'options',
				options: [
					{ name: 'Created', value: 'CREATED' },
					{ name: 'Name', value: 'NAME' },
					{ name: 'Recent', value: 'RECENT' },
					{ name: 'Updated', value: 'UPDATED' },
				],
				default: 'RECENT',
			},
		],
	},
	simplifyField,
	{
		displayName:
			"Presentations with no slides yet aren't listed. To check on one you just started, use 'Get Status' with its request_id.",
		name: 'getManyNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = { show: { resource: ['presentation'], operation: ['getMany'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', itemIndex, 50) as number);
	const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
	const sort = this.getNodeParameter('sort', itemIndex, {}) as IDataObject;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const qs: Record<string, string | number> = { sort: toText(sort.sortBy) || 'RECENT' };
	const projectId = locatorValue(filters.projectId);
	if (projectId) qs.project_id = projectId;
	const search = toText(filters.search).trim();
	if (search) qs.search = search;
	if (filters.starredOnly === true) qs.flag = 'STARRED';

	// The page size stays the same on every page, or the API's page numbers would
	// shift and repeat presentations.
	const pageSize = Math.min(API_PAGE_SIZE, limit);
	const decks: Deck[] = [];
	for (let page = 1; decks.length < limit; page++) {
		const response = await listDecks.call(this, { ...qs, page, limit: pageSize });
		decks.push(...response.data);
		if (response.data.length < pageSize || page * pageSize >= response.total) break;
	}

	return decks.slice(0, limit).map((deck) => ({
		json: simplify ? simplifyDeck(deck) : deck,
		pairedItem: { item: itemIndex },
	}));
}
