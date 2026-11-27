import { entity, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.personSub) })
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.personSub),
  exclude: ['personSub', 'sprintId'],
})
@role('authenticated', 'delete', { policy: (claims, item) => claims.sub.eq(item.personSub) })
export class Learner {
  @uuid() id!: string;
  @uuid() sprintId!: string;
  @text({ max: 120 }) personSub!: string;
  @text({ max: 100 }) personName!: string;
  @text({ max: 40 }) team!: string;
}
