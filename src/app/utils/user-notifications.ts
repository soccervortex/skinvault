import { ObjectId, Db } from 'mongodb';

export type UserNotificationDoc = {
  _id: ObjectId;
  steamId: string;
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  readAt?: Date;
  meta?: any;
};

export async function createUserNotification(
  db: Db,
  steamId: string,
  type: string,
  title: string,
  message: string,
  meta?: any
): Promise<void> {
  const id = String(steamId || '').trim();
  if (!/^\d{17}$/.test(id)) return;

  const t = String(type || '').trim() || 'info';
  const ttl = String(title || '').trim().slice(0, 200);
  const msg = String(message || '').trim().slice(0, 2000);

  const col = db.collection<UserNotificationDoc>('user_notifications');
  await col.insertOne({
    _id: new ObjectId(),
    steamId: id,
    type: t,
    title: ttl,
    message: msg,
    createdAt: new Date(),
    meta: meta ?? null,
  } as any);
}
