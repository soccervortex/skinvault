# MongoDB Connection Pool Fix

## Probleem
MongoDB Atlas M0 cluster heeft een limiet van 500 verbindingen. De applicatie maakte te veel nieuwe verbindingen aan in plaats van de gedeelde connection pool te gebruiken, waardoor de limiet werd bereikt.

## Oplossingen Geïmplementeerd

### ✅ 1. Connection Pool Settings Verlaagd
- `maxPoolSize`: 10 → 5
- `minPoolSize`: 2 → 1
- Toegevoegd: `socketTimeoutMS: 45000`

### ✅ 2. Gedeelde Connection Pool
- `database.ts` gebruikt nu de gedeelde pool uit `mongodb-client.ts`
- `mongodb-auto-index.ts` gebruikt nu de gedeelde pool
- `api/chat/report/route.ts` gefixed
- `api/chat/messages/[messageId]/route.ts` gefixed

## ✅ Alle Routes Gefixed!

Alle API routes gebruiken nu de gedeelde connection pool:

1. ✅ `src/app/api/chat/backup/route.ts`
2. ✅ `src/app/api/admin/collections/route.ts`
3. ✅ `src/app/api/admin/user/[steamId]/route.ts`
4. ✅ `src/app/api/admin/chat/pin/route.ts` (gebruikt alleen dbGet/dbSet, geen MongoDB direct)
5. ✅ `src/app/api/admin/chat/bulk-delete/route.ts`
6. ✅ `src/app/api/admin/setup-indexes/route.ts`
7. ✅ `src/app/api/admin/migrate-kv-to-mongodb/route.ts`
8. ✅ `src/app/api/chat/reset/route.ts`
9. ✅ `src/app/api/chat/report/route.ts`
10. ✅ `src/app/api/chat/messages/[messageId]/route.ts`

### Fix Pattern voor elke route:

**Vervang dit:**
```typescript
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'skinvault';

async function getMongoClient() {
  if (!MONGODB_URI) {
    throw new Error('MongoDB URI not configured');
  }
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  return client;
}
```

**Door dit:**
```typescript
import { getDatabase } from '@/app/utils/mongodb-client';
```

**En vervang alle:**
```typescript
const client = await getMongoClient();
const db = client.db(MONGODB_DB_NAME);
```

**Door:**
```typescript
const db = await getDatabase();
```

**En verwijder alle:**
```typescript
await client.close();
```

**Want de connection pool beheert dit automatisch.**

## Directe Actie Vereist

1. **Herstart de applicatie** - Dit sluit alle bestaande verbindingen
2. **Monitor MongoDB Atlas** - Controleer of het aantal verbindingen daalt
3. **✅ Alle routes zijn nu gefixed!** - Alle API routes gebruiken de gedeelde connection pool

## Monitoring

Check MongoDB Atlas dashboard:
- Ga naar je cluster → Metrics → Connections
- Het aantal actieve verbindingen zou nu veel lager moeten zijn (max 5-10 in plaats van 500)

## Belangrijk

- **Gebruik ALTIJD** `getDatabase()` uit `mongodb-client.ts` voor nieuwe code
- **Maak NOOIT** nieuwe `MongoClient()` instanties aan
- De connection pool beheert automatisch het openen en sluiten van verbindingen

