import { date, entity, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.hostSub) })
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.hostSub),
  exclude: ['hostSub'],
})
@role('authenticated', 'delete', { policy: (claims, item) => claims.sub.eq(item.hostSub) })
export class Sprint {
  @uuid() id!: string;
  @text({ min: 3, max: 60 }) name!: string;
  @date() startsOn!: Date;
  @date() endsOn!: Date;
  @text({ max: 120 }) hostSub!: string;
}
