import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import { listProjects } from '../../transport';
import type { ProjectDetail } from '../../types';
import { simplifyField } from '../presentation/fields';
import { simplifyProject } from './common';

// The API returns at most 200 projects per page.
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
			{
				displayName: 'Kind',
				name: 'kind',
				type: 'options',
				options: [
					{ name: 'Folder', value: 'FOLDER' },
					{ name: 'Project', value: 'PROJECT' },
				],
				default: 'PROJECT',
				description:
					'Whether to list projects or folders. Without this filter, projects are listed.',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description:
					"Only projects whose name contains this text, ignoring case. Presentations.AI can't search projects, so the node reads every page and filters them itself.",
			},
		],
	},
	simplifyField,
];

const displayOptions = { show: { resource: ['project'], operation: ['getMany'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const returnAll = this.getNodeParameter('returnAll', itemIndex, false) as boolean;
	const limit = returnAll ? Infinity : (this.getNodeParameter('limit', itemIndex, 50) as number);
	const filters = this.getNodeParameter('filters', itemIndex, {}) as IDataObject;
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;

	const kind = toText(filters.kind).trim().toUpperCase() || 'PROJECT';
	const needle = toText(filters.search).trim().toLowerCase();

	// With a search the matches can be on any page, so pages are read whole.
	// The page size stays the same on every page, or the API's page numbers
	// would shift and repeat projects.
	const pageSize = needle ? API_PAGE_SIZE : Math.min(API_PAGE_SIZE, limit);
	const projects: ProjectDetail[] = [];
	for (let page = 1; projects.length < limit; page++) {
		const response = await listProjects.call(this, { kind, page, limit: pageSize });
		for (const project of response.data) {
			if (needle && !toText(project.name).toLowerCase().includes(needle)) continue;
			projects.push(project);
		}
		if (response.data.length < pageSize || page * pageSize >= response.total) break;
	}

	return projects.slice(0, limit).map((project) => ({
		json: simplify ? simplifyProject(project) : project,
		pairedItem: { item: itemIndex },
	}));
}
