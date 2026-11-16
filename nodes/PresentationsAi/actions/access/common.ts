import type { IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { toText } from '../../helpers/utils';
import type { GrantRole } from '../../types';

const ROLES: GrantRole[] = ['COMMENT', 'EDIT', 'VIEW'];

export const roleField: INodeProperties = {
	displayName: 'Role',
	name: 'role',
	type: 'options',
	required: true,
	options: [
		{ name: 'Comment', value: 'COMMENT', description: 'Can view and comment' },
		{ name: 'Edit', value: 'EDIT', description: 'Can view, comment and edit' },
		{ name: 'View', value: 'VIEW', description: 'Can only view' },
	],
	default: 'VIEW',
	description: 'What the person can do with the presentation',
};

export const grantIdField: INodeProperties = {
	displayName: 'Grant ID',
	name: 'grantId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'e.g. 9b1f2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d',
	description: "The ID of the person's access, from the output of 'Grant' or 'Get Many'",
};

export function readRole(this: IExecuteFunctions, itemIndex: number): GrantRole {
	const value = toText(this.getNodeParameter('role', itemIndex, 'VIEW')).trim();
	const role = (value || 'VIEW').toUpperCase() as GrantRole;
	if (!ROLES.includes(role)) {
		throw new NodeOperationError(
			this.getNode(),
			`'Role' must be View, Comment or Edit, not '${value}'`,
			{ itemIndex },
		);
	}
	return role;
}

export function readGrantId(this: IExecuteFunctions, itemIndex: number): string {
	const grantId = toText(this.getNodeParameter('grantId', itemIndex, '')).trim();
	if (!grantId) {
		throw new NodeOperationError(this.getNode(), "The 'Grant ID' parameter is empty", {
			itemIndex,
			description: "Map the 'id' from the 'Grant' or 'Get Many' operation.",
		});
	}
	return grantId;
}
