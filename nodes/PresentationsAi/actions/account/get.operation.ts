import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';

import { getMe } from '../../transport';
import type { Me } from '../../types';
import { simplifyField } from '../presentation/fields';

const properties: INodeProperties[] = [simplifyField];

const displayOptions = { show: { resource: ['account'], operation: ['get'] } };

export const description = updateDisplayOptions(displayOptions, properties);

export function simplifyMe(me: Me): IDataObject {
	return {
		user_id: me.user_id,
		email: me.email,
		workspace_id: me.workspace_id,
		project_id: me.project_id ?? null,
		plan: me.plan ?? null,
		max_model: me.max_model ?? null,
		plan_features: me.plan_features ?? [],
		scopes: me.scopes ?? [],
		role_at_issuance: me.role_at_issuance ?? null,
	};
}

export async function execute(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const me = await getMe.call(this);
	const simplify = this.getNodeParameter('simplify', itemIndex, true) as boolean;
	return [{ json: simplify ? simplifyMe(me) : me, pairedItem: { item: itemIndex } }];
}
