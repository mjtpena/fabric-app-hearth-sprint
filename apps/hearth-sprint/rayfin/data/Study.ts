import { date, entity, int, role, set, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.learnerSub) })
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.learnerSub),
  exclude: ['learnerSub', 'sprintId'],
})
@role('authenticated', 'delete', { policy: (claims, item) => claims.sub.eq(item.learnerSub) })
export class Study {
  @uuid() id!: string;
  @uuid() sprintId!: string;
  @uuid() topicId!: string;
  @text({ max: 120 }) learnerSub!: string;
  @date() day!: Date;
  @int() minutes!: number;
  @set('read', 'watch', 'build', 'teach') kind!: 'read' | 'watch' | 'build' | 'teach';
  @text({ max: 200, optional: true }) note?: string;
}
