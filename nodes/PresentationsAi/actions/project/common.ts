import type { IDataObject } from 'n8n-workflow';

import type { ProjectDetail } from '../../types';

// Ten of the project's fields. The API returns more than ten, so n8n's UX
// guidelines ask for this behind "Simplify".
export function simplifyProject(project: ProjectDetail): IDataObject {
	return {
		id: project.id,
		name: project.name,
		kind: project.kind,
		parent_id: project.parent_id ?? null,
		workspace_visible: project.workspace_visible ?? null,
		default_member_role: project.default_member_role ?? null,
		has_share_link: project.has_share_link ?? false,
		archived_at: project.archived_at ?? null,
		created_at: project.created_at,
		slug: project.slug ?? null,
	};
}
