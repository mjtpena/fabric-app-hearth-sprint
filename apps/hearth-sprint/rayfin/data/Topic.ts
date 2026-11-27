import { decimal, entity, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.hostSub) })
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.hostSub),
  exclude: ['hostSub', 'sprintId'],
})
@role('authenticated', 'delete', { policy: (claims, item) => claims.sub.eq(item.hostSub) })
export class Topic {
  @uuid() id!: string;
  @uuid() sprintId!: string;
  @text({ max: 120 }) hostSub!: string;
  @text({ min: 3, max: 60 }) title!: string;
  @decimal() weight!: number;
}
