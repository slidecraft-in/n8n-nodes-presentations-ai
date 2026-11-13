import type { IDataObject } from 'n8n-workflow';

function isOutline(value: unknown): value is IDataObject {
	return (
		typeof value === 'object' && value !== null && Array.isArray((value as IDataObject).slides)
	);
}

// The outline to build a presentation from. Accepts the outline itself, the
// whole output of 'Outline → Create' ({ outline }) or of 'Get Outline'
// ({ outline, final_outline }, where final_outline is the one the slides were
// generated from), as an object or as JSON text. Returns undefined when none
// of these hold a 'slides' list.
export function toOutline(value: unknown): IDataObject | undefined {
	let parsed = value;
	if (typeof parsed === 'string') {
		const text = parsed.trim();
		if (!text) return undefined;
		try {
			parsed = JSON.parse(text) as unknown;
		} catch {
			return undefined;
		}
	}
	if (isOutline(parsed)) return parsed;
	if (typeof parsed !== 'object' || parsed === null) return undefined;
	const wrapper = parsed as IDataObject;
	if (isOutline(wrapper.final_outline)) return wrapper.final_outline;
	if (isOutline(wrapper.outline)) return wrapper.outline;
	return undefined;
}
