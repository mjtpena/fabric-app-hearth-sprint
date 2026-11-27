import { entity, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.authorSub) })
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.authorSub),
  exclude: ['authorSub', 'sprintId'],
})
@role('authenticated', 'delete', { policy: (claims, item) => claims.sub.eq(item.authorSub) })
export class Card {
  @uuid() id!: string;
  @uuid() topicId!: string;
  @uuid() sprintId!: string;
  @text({ max: 120 }) authorSub!: string;
  @text({ max: 100 }) authorName!: string;
  @text({ min: 3, max: 200 }) prompt!: string;
  @text({ min: 1, max: 200 }) answer!: string;
}
