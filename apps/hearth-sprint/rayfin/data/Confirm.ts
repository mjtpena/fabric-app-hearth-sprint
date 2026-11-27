import { boolean, date, entity, role, text, uuid } from '@microsoft/rayfin-core';

@entity()
@role('authenticated', 'read')
@role('authenticated', 'create', { policy: (claims, item) => claims.sub.eq(item.confirmerSub) })
@role('authenticated', 'update', {
  policy: (claims, item) => claims.sub.eq(item.confirmerSub),
  exclude: ['confirmerSub', 'sprintId', 'recallId'],
})
@role('authenticated', 'delete', { policy: (claims, item) => claims.sub.eq(item.confirmerSub) })
export class Confirm {
  @uuid() id!: string;
  @uuid() recallId!: string;
  @uuid() sprintId!: string;
  @text({ max: 120 }) confirmerSub!: string;
  @boolean() agrees!: boolean;
  @date() at!: Date;
}
