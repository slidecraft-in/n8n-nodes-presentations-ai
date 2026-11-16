import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError, updateDisplayOptions } from 'n8n-workflow';

import { locatorValue } from '../../helpers/utils';
import { getProject } from '../../transport';
import { projectLocator, simplifyField } from '../presentation/fields';
import { simplifyProject } from './common';

const properties: INodeProperties[] = [
	{ ...projectLocator('project', 'The project or folder to get'), required: true },
	simplifyField,
];

const displayOptions = { show: { resource: ['project'], operation: ['get'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const projectId = locatorValue(this.getNodeParameter('project', itemIndex, ''));
	if (!projectId) {
		throw new NodeOperationError(this.getNode(), "The 'Project' parameter is empty", {
			itemIndex,
			description: "Pick a project from the list, or enter its ID under 'By ID'.",
		});
	}
	const project = await getProject.call(this, projectId);
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;
	return [{ json: simplify ? simplifyProject(project) : project, pairedItem: { item: itemIndex } }];
}
