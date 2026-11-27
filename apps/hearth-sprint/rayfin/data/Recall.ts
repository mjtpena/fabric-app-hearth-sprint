import { date, entity, int, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.learnerSub) })
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.learnerSub),
  exclude: ['learnerSub', 'sprintId'],
})
@role('authenticated', 'delete', { policy: (claims, item) => claims.sub.eq(item.learnerSub) })
export class Recall {
  @uuid() id!: string;
  @uuid() sprintId!: string;
  @uuid() topicId!: string;
  @text({ max: 120 }) learnerSub!: string;
  @date() takenAt!: Date;
  @int() items!: number;
  @int() correct!: number;
}
