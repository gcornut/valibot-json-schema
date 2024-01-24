import * as v from 'valibot';

export const ListItemElement: any = v.object({
    type: v.literal('li'),
    children: v.array(v.union([v.string(), v.recursive(() => ListElement)])),
});

export const ListElement = v.object({
    type: v.literal('ul'),
    children: v.array(ListItemElement),
});

