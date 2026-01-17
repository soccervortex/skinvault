const { MongoClient, ObjectId } = require('mongodb');
const SteamUser = require('steam-user');
const SteamTotp = require('steam-totp');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');

require('dotenv').config(process.env.DOTENV_CONFIG_PATH ? { path: process.env.DOTENV_CONFIG_PATH } : undefined);

function normalizeSecret(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.includes('BASE64_SHARED_SECRET_FROM_')) return '';
  if (s.includes('BASE64_IDENTITY_SECRET_FROM_')) return '';
  if (s.toLowerCase().includes('from_sda')) return '';
  if (s.toLowerCase().includes('from_steam')) return '';
  return s;
}

function getMongoUriCandidates() {
  const candidates = [];
  const clusterEntries = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith('MONGODB_CLUSTER_') && value && String(value).trim())
    .map(([key, value]) => {
      const rawIdx = key.slice('MONGODB_CLUSTER_'.length);
      const idx = Number.parseInt(rawIdx, 10);
      return {
        key,
        idx: Number.isFinite(idx) ? idx : Number.POSITIVE_INFINITY,
        uri: String(value).trim(),
      };
    })
    .sort((a, b) => {
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.key.localeCompare(b.key);
    });
 
  for (const entry of clusterEntries) {
    candidates.push(entry.uri);
  }
  if (process.env.MONGODB_URI && String(process.env.MONGODB_URI).trim()) {
    candidates.push(String(process.env.MONGODB_URI).trim());
  }
  return Array.from(new Set(candidates));
}

function safeMongoHost(uri) {
  try {
    const u = new URL(uri);
    return u.hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function getPendingClaimsCount(db) {
  try {
    return await db.collection('giveaway_claims').countDocuments({ tradeStatus: 'PENDING' });
  } catch {
    return 0;
  }
}

async function getEligiblePendingClaimsCount(db) {
  try {
    const lockCutoff = new Date(Date.now() - CONFIG.lockTimeoutMs);
    return await db.collection('giveaway_claims').countDocuments({
      tradeStatus: 'PENDING',
      $or: [{ botLockedAt: { $exists: false } }, { botLockedAt: { $lt: lockCutoff } }],
    });
  } catch {
    return 0;
  }
}

const CONFIG = {
  mongoUris: getMongoUriCandidates(),
  mongoDbName: String(process.env.MONGODB_DB_NAME || 'skinvault'),

  accountName: String(process.env.accountName || process.env.STEAM_BOT_ACCOUNT_NAME || ''),
  password: String(process.env.password || process.env.STEAM_BOT_PASSWORD || ''),
  sharedSecret: normalizeSecret(process.env.sharedSecret || process.env.STEAM_BOT_SHARED_SECRET || ''),
  identitySecret: normalizeSecret(process.env.identitySecret || process.env.STEAM_BOT_IDENTITY_SECRET || ''),

  appId: Number(process.env.STEAM_APP_ID || 730),
  contextId: String(process.env.STEAM_CONTEXT_ID || '2'),

  pendingLoopMs: Math.max(1000, Number(process.env.PENDING_LOOP_MS || 5000)),
  pollLoopMs: Math.max(5000, Number(process.env.POLL_LOOP_MS || 30000)),
  claimBatchSize: Math.min(50, Math.max(1, Number(process.env.CLAIM_BATCH_SIZE || 5))),
  sentBatchSize: Math.min(50, Math.max(1, Number(process.env.SENT_BATCH_SIZE || 25))),
  lockTimeoutMs: Math.max(30_000, Number(process.env.CLAIM_LOCK_TIMEOUT_MS || 5 * 60_000)),

  dryRun: String(process.env.DRY_RUN || '').trim() === '1',
  verbose: String(process.env.BOT_VERBOSE || '').trim() === '1',

  exportInventory: String(process.env.EXPORT_INVENTORY || '').trim() === '1',
  exportInventoryAppId: Number(process.env.EXPORT_INVENTORY_APP_ID || process.env.STEAM_APP_ID || 730),
  exportInventoryContextId: String(process.env.EXPORT_INVENTORY_CONTEXT_ID || process.env.STEAM_CONTEXT_ID || '2').trim() || '2',
  exportInventoryLimit: Math.min(5000, Math.max(1, Number(process.env.EXPORT_INVENTORY_LIMIT || 2000))),
  exportInventoryFilter: String(process.env.EXPORT_INVENTORY_FILTER || '').trim(),
  exportInventoryDetailed: String(process.env.EXPORT_INVENTORY_DETAILED || '').trim() === '1',
};

function logInfo(tag, data) {
  if (data !== undefined) {
    console.log(tag, data);
  } else {
    console.log(tag);
  }
}

function logDebug(tag, data) {
  if (!CONFIG.verbose) return;
  logInfo(tag, data);
}

function logStructured(tag, data) {
  console.log(JSON.stringify({ tag, ...data }));
}

function isValidTradeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    if (u.hostname !== 'steamcommunity.com') return false;
    if (u.pathname !== '/tradeoffer/new/') return false;
    const partner = u.searchParams.get('partner');
    const token = u.searchParams.get('token');
    if (!partner || !/^\d+$/.test(partner)) return false;
    if (!token || !/^[A-Za-z0-9_-]{6,64}$/.test(token)) return false;
    return true;
  } catch {
    return false;
  }
}

async function createUserNotification(db, steamId, type, title, message, meta) {
  const id = String(steamId || '').trim();
  if (!/^\d{17}$/.test(id)) return;
  const t = String(type || '').trim() || 'info';
  const ttl = String(title || '').trim().slice(0, 200);
  const msg = String(message || '').trim().slice(0, 2000);

  await db.collection('user_notifications').insertOne({
    _id: new ObjectId(),
    steamId: id,
    type: t,
    title: ttl,
    message: msg,
    createdAt: new Date(),
    meta: meta ?? null,
  });
}

async function connectMongo() {
  const candidates = Array.isArray(CONFIG.mongoUris) ? CONFIG.mongoUris : [];
  if (!candidates.length) throw new Error('MongoDB URI is missing');

  let lastError = null;
  let fallback = null;

  for (const uri of candidates) {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      maxPoolSize: 5,
    });
    try {
      await client.connect();
      const db = client.db(CONFIG.mongoDbName);
      const host = safeMongoHost(uri);
      const pendingClaims = await getPendingClaimsCount(db);
      const eligiblePendingClaims = await getEligiblePendingClaimsCount(db);

      if (CONFIG.verbose) {
        logInfo('[mongo] candidate', { host, dbName: CONFIG.mongoDbName, pendingClaims, eligiblePendingClaims });
      }

      if (!fallback) {
        fallback = { client, db, uri, pendingClaims, eligiblePendingClaims };
      }

      if (eligiblePendingClaims > 0) {
        logInfo('[mongo] using candidate with eligible pending claims', {
          host,
          dbName: CONFIG.mongoDbName,
          pendingClaims,
          eligiblePendingClaims,
        });
        if (fallback && fallback.client !== client) {
          try {
            await fallback.client.close();
          } catch {
          }
        }
        return { client, db };
      }

      // Not selected; close this client unless it's our fallback.
      if (fallback.client !== client) {
        try {
          await client.close();
        } catch {
        }
      }
    } catch (e) {
      lastError = e;
      try {
        await client.close();
      } catch {
      }
    }
  }

  if (fallback) {
    logInfo('[mongo] using first available connection', {
      host: safeMongoHost(fallback.uri),
      dbName: CONFIG.mongoDbName,
      pendingClaims: fallback.pendingClaims,
      eligiblePendingClaims: fallback.eligiblePendingClaims,
    });
    return { client: fallback.client, db: fallback.db };
  }

  throw lastError || new Error('MongoDB connection failed');
}

function makeSteamClients() {
  const user = new SteamUser();
  const community = new SteamCommunity();
  const manager = new TradeOfferManager({
    steam: user,
    community,
    language: 'en',
  });

  user.on('error', (err) => {
    console.error('[steam-user] error', err);
  });

  user.on('disconnected', (eresult, msg) => {
    console.warn('[steam-user] disconnected', { eresult, msg });
  });

  user.on('loggedOn', (details) => {
    console.log('[steam-user] logged on', details);
  });

  user.on('webSession', (sessionid, cookies) => {
    console.log('[steam-user] webSession');
    community.setCookies(cookies);
    manager.setCookies(cookies, (err) => {
      if (err) {
        console.error('[tradeoffer-manager] setCookies failed', err);
      } else {
        console.log('[tradeoffer-manager] cookies set');
      }
    });
  });

  return { user, community, manager };
}

function logOnSteam(user) {
  if (!CONFIG.accountName || !CONFIG.password) {
    throw new Error('Missing bot credentials: accountName/password');
  }

  const details = {
    accountName: CONFIG.accountName,
    password: CONFIG.password,
  };

  if (CONFIG.sharedSecret) {
    details.twoFactorCode = SteamTotp.generateAuthCode(CONFIG.sharedSecret);
  }

  user.logOn(details);
}

function getInventoryContents(manager, appId, contextId, tradableOnly) {
  return new Promise((resolve, reject) => {
    manager.getInventoryContents(appId, contextId, tradableOnly, (err, inventory) => {
      if (err) return reject(err);
      resolve(Array.isArray(inventory) ? inventory : []);
    });
  });
}

function getOffer(manager, offerId) {
  return new Promise((resolve, reject) => {
    manager.getOffer(String(offerId), (err, offer) => {
      if (err) return reject(err);
      resolve(offer);
    });
  });
}

function sendOffer(offer) {
  return new Promise((resolve, reject) => {
    offer.send((err, status) => {
      if (err) return reject(err);
      resolve({ status });
    });
  });
}

function acceptConfirmation(community, identitySecret, tradeOfferId) {
  if (!identitySecret) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    community.acceptConfirmationForObject(identitySecret, String(tradeOfferId), (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

const inventoryCacheByKey = new Map();
async function getBotInventory(manager, appId, contextId) {
  const a = Number(appId || CONFIG.appId);
  const c = String(contextId || CONFIG.contextId);
  const key = `${a}:${c}`;
  const now = Date.now();
  const cached = inventoryCacheByKey.get(key);
  if (cached?.items?.length && now - Number(cached.loadedAt || 0) < 60_000) {
    return cached.items;
  }

  const items = await getInventoryContents(manager, a, c, true);
  inventoryCacheByKey.set(key, { loadedAt: now, items });
  return items;
}

function exportInventoryLines(inventory) {
  const filter = String(CONFIG.exportInventoryFilter || '').toLowerCase();

  const rows = (Array.isArray(inventory) ? inventory : [])
    .map((it) => {
      const assetId = String(it?.assetid || it?.assetId || it?.id || '').trim();
      const classId = String(it?.classid || it?.classId || '').trim();
      const instanceId = String(it?.instanceid || it?.instanceId || '').trim();
      const marketHashName = String(it?.market_hash_name || '').trim();
      const name = String(it?.name || '').trim();
      return {
        assetId,
        classId: classId || null,
        instanceId: instanceId || null,
        marketHashName: marketHashName || null,
        name: name || null,
      };
    })
    .filter((r) => r.assetId);

  const filtered = filter
    ? rows.filter((r) =>
        String(r.marketHashName || '').toLowerCase().includes(filter) || String(r.name || '').toLowerCase().includes(filter)
      )
    : rows;

  filtered.sort((a, b) => {
    const ak = String(a.marketHashName || a.name || '');
    const bk = String(b.marketHashName || b.name || '');
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    if (a.assetId < b.assetId) return -1;
    if (a.assetId > b.assetId) return 1;
    return 0;
  });

  const limited = filtered.slice(0, CONFIG.exportInventoryLimit);
  return {
    total: rows.length,
    matched: filtered.length,
    limited,
  };
}

function findInventoryItemByAssetId(inventory, assetId) {
  const id = String(assetId || '').trim();
  if (!id) return null;
  return (
    inventory.find((it) => String(it?.assetid || it?.assetId || it?.id || '').trim() === id) || null
  );
}

function findInventoryItemForMarketHash(inventory, marketHashName) {
  const key = String(marketHashName || '').trim();
  if (!key) return null;

  const direct = inventory.find((it) => String(it?.market_hash_name || '').trim() === key);
  if (direct) return direct;

  const byName = inventory.find((it) => String(it?.name || '').trim() === key);
  if (byName) return byName;

  return null;
}

async function setClaimFailed(db, claimId, giveawayIdStr, steamId, reason, extra = {}) {
  const now = new Date();
  await db.collection('giveaway_claims').updateOne(
    { _id: claimId },
    {
      $set: {
        tradeStatus: 'FAILED',
        lastError: String(reason || 'Failed'),
        updatedAt: now,
        ...extra,
      },
      $unset: { botLockedAt: '', botLockId: '' },
    }
  );

  try {
    const claim = await db.collection('giveaway_claims').findOne({ _id: claimId }, {
      projection: { prizeStockId: 1 },
    });
    const prizeStockId = claim?.prizeStockId || null;
    if (prizeStockId) {
      await db.collection('giveaway_prize_stock').updateOne(
        { _id: prizeStockId },
        {
          $set: { status: 'AVAILABLE', updatedAt: now },
          $unset: {
            reservedBySteamId: '',
            reservedAt: '',
            steamTradeOfferId: '',
            sentAt: '',
          },
        }
      );

      await db.collection('giveaway_claims').updateOne(
        { _id: claimId },
        {
          $unset: {
            prizeStockId: '',
            assetId: '',
            classId: '',
            instanceId: '',
            assetAppIdExact: '',
            assetContextIdExact: '',
          },
          $set: { updatedAt: now },
        }
      );
    }
  } catch {
  }

  await db.collection('giveaway_winners').updateOne(
    { _id: giveawayIdStr },
    {
      $set: {
        'winners.$[w].claimStatus': 'pending',
        updatedAt: now,
      },
      $unset: {
        'winners.$[w].claimedAt': '',
      },
    },
    { arrayFilters: [{ 'w.steamId': String(steamId) }] }
  );

  try {
    await createUserNotification(
      db,
      steamId,
      'giveaway_trade_failed',
      'Trade Failed',
      'We could not send your giveaway trade. Please try claiming again in the Giveaways page.',
      { giveawayId: giveawayIdStr, reason: String(reason || '') }
    );
  } catch {
    // ignore
  }
}

async function setClaimSuccess(db, claimId, giveawayIdStr, steamId, offerId) {
  const now = new Date();
  await db.collection('giveaway_claims').updateOne(
    { _id: claimId },
    {
      $set: {
        tradeStatus: 'SUCCESS',
        updatedAt: now,
        completedAt: now,
        steamTradeOfferId: String(offerId || ''),
      },
    }
  );

  try {
    const claim = await db.collection('giveaway_claims').findOne({ _id: claimId }, {
      projection: { prizeStockId: 1 },
    });
    const prizeStockId = claim?.prizeStockId || null;
    if (prizeStockId) {
      await db.collection('giveaway_prize_stock').updateOne(
        { _id: prizeStockId },
        {
          $set: { status: 'DELIVERED', steamTradeOfferId: String(offerId || ''), deliveredAt: now, updatedAt: now },
        }
      );
    }
  } catch {
  }

  await db.collection('giveaway_winners').updateOne(
    { _id: giveawayIdStr },
    {
      $set: {
        'winners.$[w].claimStatus': 'claimed',
        'winners.$[w].claimedAt': now,
        updatedAt: now,
      },
    },
    { arrayFilters: [{ 'w.steamId': String(steamId) }] }
  );

  try {
    await createUserNotification(
      db,
      steamId,
      'giveaway_trade_accepted',
      'Prize Delivered',
      'Your giveaway trade offer was accepted. Enjoy your prize!',
      { giveawayId: giveawayIdStr, steamTradeOfferId: String(offerId || '') }
    );
  } catch {
    // ignore
  }
}

async function pickAndLockPendingClaim(db) {
  const now = new Date();
  const lockCutoff = new Date(Date.now() - CONFIG.lockTimeoutMs);
  const res = await db.collection('giveaway_claims').findOneAndUpdate(
    {
      tradeStatus: 'PENDING',
      $or: [{ botLockedAt: { $exists: false } }, { botLockedAt: { $lt: lockCutoff } }],
    },
    {
      $set: { botLockedAt: now, botLockId: `pid:${process.pid}`, updatedAt: now },
    },
    { sort: { updatedAt: 1 }, returnDocument: 'after' }
  );

  // MongoDB Node driver return shapes vary by version/options:
  // - ModifyResult: { value: <doc|null>, ... }
  // - Document directly: <doc|null>
  if (res && typeof res === 'object' && 'value' in res) {
    return res.value || null;
  }
  if (res && typeof res === 'object' && res._id) {
    return res;
  }
  return null;
}

async function processPendingClaimsOnce(db, manager, community) {
  let processed = 0;
  let foundAny = false;

  if (CONFIG.verbose) {
    try {
      const lockCutoff = new Date(Date.now() - CONFIG.lockTimeoutMs);
      const pendingCount = await db.collection('giveaway_claims').countDocuments({ tradeStatus: 'PENDING' });
      const eligibleCount = await db.collection('giveaway_claims').countDocuments({
        tradeStatus: 'PENDING',
        $or: [{ botLockedAt: { $exists: false } }, { botLockedAt: { $lt: lockCutoff } }],
      });
      logInfo('[pending] counts', { pendingCount, eligibleCount });
    } catch {
      // ignore
    }
  }

  for (let i = 0; i < CONFIG.claimBatchSize; i++) {
    const claim = await pickAndLockPendingClaim(db);
    if (!claim) {
      if (CONFIG.verbose && i === 0) {
        try {
          const lockCutoff = new Date(Date.now() - CONFIG.lockTimeoutMs);
          const pendingCount = await db.collection('giveaway_claims').countDocuments({ tradeStatus: 'PENDING' });
          const eligibleCount = await db.collection('giveaway_claims').countDocuments({
            tradeStatus: 'PENDING',
            $or: [{ botLockedAt: { $exists: false } }, { botLockedAt: { $lt: lockCutoff } }],
          });

          const sample = await db.collection('giveaway_claims').findOne(
            { tradeStatus: 'PENDING' },
            { projection: { _id: 1, giveawayId: 1, steamId: 1, botLockedAt: 1, botLockId: 1, updatedAt: 1, lastError: 1 } }
          );
          logInfo('[pending] pick returned null', {
            pid: process.pid,
            pendingCount,
            eligibleCount,
            lockTimeoutMs: CONFIG.lockTimeoutMs,
            sample: sample
              ? {
                  id: String(sample._id),
                  giveawayId: String(sample.giveawayId || ''),
                  steamId: String(sample.steamId || ''),
                  botLockedAt: sample.botLockedAt ? new Date(sample.botLockedAt).toISOString?.() || String(sample.botLockedAt) : null,
                  botLockId: sample.botLockId ? String(sample.botLockId) : null,
                  updatedAt: sample.updatedAt ? new Date(sample.updatedAt).toISOString?.() || String(sample.updatedAt) : null,
                  lastError: sample.lastError ? String(sample.lastError) : null,
                }
              : null,
          });
        } catch {
          // ignore
        }
      }
      break;
    }

    foundAny = true;

    const claimId = claim._id;
    const steamId = String(claim?.steamId || '').trim();
    const giveawayId = claim?.giveawayId;
    const giveawayIdStr = String(giveawayId || '').trim();
    const tradeUrl = String(claim?.tradeUrl || '').trim();
    const itemId = String(claim?.itemId || '').trim();
    const prizeStockId = claim?.prizeStockId || null;
    const assetId = String(claim?.assetId || '').trim();
    const assetAppIdExact = Number(claim?.assetAppIdExact || claim?.assetAppId || CONFIG.appId);
    const assetContextIdExact = String(claim?.assetContextIdExact || claim?.assetContextId || CONFIG.contextId).trim();

    logStructured('[claim] picked', {
      claimId: String(claimId),
      giveawayId: giveawayIdStr,
      steamId,
      prizeStockId: prizeStockId ? String(prizeStockId) : null,
      itemId: itemId || null,
      assetId: assetId || null,
      dryRun: CONFIG.dryRun,
    });

    const tradeUrlOk = isValidTradeUrl(tradeUrl);
    if (CONFIG.verbose) {
      logInfo('[claim] validate', {
        claimId: String(claimId),
        giveawayId: giveawayIdStr,
        steamId,
        tradeUrlOk,
        hasItemId: !!itemId,
        hasAssetId: !!assetId,
      });
    }

    if (!/^\d{17}$/.test(steamId) || !/^[0-9a-fA-F]{24}$/.test(giveawayIdStr)) {
      logInfo('[claim] fail', { claimId: String(claimId), giveawayId: giveawayIdStr, steamId, reason: 'Invalid claim payload' });
      await setClaimFailed(db, claimId, giveawayIdStr, steamId, 'Invalid claim payload');
      processed++;
      continue;
    }

    if (!tradeUrlOk) {
      logInfo('[claim] fail', { claimId: String(claimId), giveawayId: giveawayIdStr, steamId, reason: 'Invalid trade URL' });
      await setClaimFailed(db, claimId, giveawayIdStr, steamId, 'Invalid trade URL');
      processed++;
      continue;
    }

    if (!itemId && !assetId) {
      logInfo('[claim] fail', { claimId: String(claimId), giveawayId: giveawayIdStr, steamId, reason: 'Missing itemId/assetId' });
      await setClaimFailed(db, claimId, giveawayIdStr, steamId, 'Missing itemId/assetId');
      processed++;
      continue;
    }

    const wdoc = await db
      .collection('giveaway_winners')
      .findOne({ _id: giveawayIdStr }, { projection: { winners: 1 } });
    const winners = Array.isArray(wdoc?.winners) ? wdoc.winners : [];
    const mine = winners.find((w) => String(w?.steamId || '') === steamId) || null;

    if (!mine) {
      logInfo('[claim] fail', {
        claimId: String(claimId),
        giveawayId: giveawayIdStr,
        steamId,
        reason: 'Winner record not found',
        winnersDocFound: !!wdoc,
        winnersCount: Array.isArray(winners) ? winners.length : 0,
      });
      await setClaimFailed(db, claimId, giveawayIdStr, steamId, 'Winner record not found');
      processed++;
      continue;
    }

    const claimStatus = String(mine?.claimStatus || '');
    if (claimStatus !== 'pending_trade') {
      logInfo('[claim] fail', {
        claimId: String(claimId),
        giveawayId: giveawayIdStr,
        steamId,
        reason: 'Unexpected winner status',
        claimStatus,
      });
      await db.collection('giveaway_claims').updateOne(
        { _id: claimId },
        {
          $set: {
            tradeStatus: 'FAILED',
            lastError: `Unexpected winner status: ${claimStatus}`,
            updatedAt: new Date(),
          },
          $unset: { botLockedAt: '', botLockId: '' },
        }
      );
      processed++;
      continue;
    }

    const deadlineMs = mine?.claimDeadlineAt ? new Date(mine.claimDeadlineAt).getTime() : NaN;
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
      logInfo('[claim] fail', {
        claimId: String(claimId),
        giveawayId: giveawayIdStr,
        steamId,
        reason: 'Claim window expired',
        claimDeadlineAt: mine?.claimDeadlineAt ? new Date(mine.claimDeadlineAt).toISOString?.() || String(mine.claimDeadlineAt) : null,
      });
      await db.collection('giveaway_claims').updateOne(
        { _id: claimId },
        {
          $set: {
            tradeStatus: 'FAILED',
            lastError: 'Claim window expired',
            updatedAt: new Date(),
          },
          $unset: { botLockedAt: '', botLockId: '' },
        }
      );
      processed++;
      continue;
    }

    try {
      if (CONFIG.dryRun) {
        logInfo('[dry-run] would send offer', { giveawayId: giveawayIdStr, steamId, itemId, assetId, prizeStockId });
        await db.collection('giveaway_claims').updateOne(
          { _id: claimId },
          {
            $set: { tradeStatus: 'SENT', steamTradeOfferId: 'dry-run', updatedAt: new Date(), sentAt: new Date() },
            $unset: { botLockedAt: '', botLockId: '' },
          }
        );

        if (CONFIG.verbose) {
          try {
            const after = await db.collection('giveaway_claims').findOne(
              { _id: claimId },
              { projection: { _id: 1, tradeStatus: 1, steamTradeOfferId: 1, updatedAt: 1, lastError: 1 } }
            );
            logInfo('[dry-run] claim after update', {
              claimId: String(claimId),
              tradeStatus: after?.tradeStatus || null,
              steamTradeOfferId: after?.steamTradeOfferId || null,
              lastError: after?.lastError || null,
            });
          } catch {
          }
        }

        if (prizeStockId) {
          try {
            await db.collection('giveaway_prize_stock').updateOne(
              { _id: prizeStockId },
              { $set: { status: 'SENT', steamTradeOfferId: 'dry-run', sentAt: new Date(), updatedAt: new Date() } }
            );
          } catch {
          }
        }

        // Complete the pipeline immediately in dry-run so operators can validate end-to-end
        // without relying on the poll loop.
        try {
          await setClaimSuccess(db, claimId, giveawayIdStr, steamId, 'dry-run');
        } catch (e) {
          logInfo('[dry-run] failed to finalize success', { claimId: String(claimId), message: e?.message || String(e) });
        }

        processed++;
        continue;
      }

      const inventory = await getBotInventory(manager, assetAppIdExact, assetContextIdExact);
      const item = assetId ? findInventoryItemByAssetId(inventory, assetId) : findInventoryItemForMarketHash(inventory, itemId);

      if (!item) {
        await setClaimFailed(db, claimId, giveawayIdStr, steamId, 'Item not available in bot inventory');
        processed++;
        continue;
      }

      logDebug('[claim] item selected', {
        claimId: String(claimId),
        giveawayId: giveawayIdStr,
        steamId,
        usingAssetId: !!assetId,
        inventoryAssetId: String(item?.assetid || item?.assetId || item?.id || ''),
        marketHashName: String(item?.market_hash_name || ''),
      });

      const offer = manager.createOffer(tradeUrl);
      offer.addMyItem(item);
      offer.setMessage(`SkinVaults Giveaway Prize: ${String(claim?.prize || itemId).slice(0, 200)}`);

      logInfo('[trade] sending offer', {
        giveawayId: giveawayIdStr,
        steamId,
        prizeStockId: prizeStockId ? String(prizeStockId) : null,
        itemId: itemId || null,
        assetId: assetId || null,
      });

      const { status } = await sendOffer(offer);
      const tradeOfferId = String(offer?.id || '').trim();

      if (!tradeOfferId) {
        await setClaimFailed(db, claimId, giveawayIdStr, steamId, 'Trade offer ID missing after send');
        processed++;
        continue;
      }

      logInfo('[trade] offer sent', { tradeOfferId, status, giveawayId: giveawayIdStr, steamId });

      await db.collection('giveaway_claims').updateOne(
        { _id: claimId },
        {
          $set: {
            tradeStatus: 'SENT',
            steamTradeOfferId: tradeOfferId,
            lastError: null,
            sentAt: new Date(),
            updatedAt: new Date(),
          },
          $unset: { botLockedAt: '', botLockId: '' },
        }
      );

      if (prizeStockId) {
        try {
          await db.collection('giveaway_prize_stock').updateOne(
            { _id: prizeStockId },
            { $set: { status: 'SENT', steamTradeOfferId: tradeOfferId, sentAt: new Date(), updatedAt: new Date() } }
          );
        } catch {
        }
      }

      try {
        await createUserNotification(
          db,
          steamId,
          'giveaway_trade_sent',
          'Trade Offer Sent',
          'Your giveaway trade offer was sent. Please check your Steam trade offers.',
          { giveawayId: giveawayIdStr, steamTradeOfferId: tradeOfferId }
        );
      } catch {
        // ignore
      }

      if (String(status || '').toLowerCase() === 'pending') {
        try {
          const ok = await acceptConfirmation(community, CONFIG.identitySecret, tradeOfferId);
          logInfo('[trade] confirmation', { tradeOfferId, ok });
        } catch (e) {
          console.warn('[confirm] failed', { tradeOfferId, message: e?.message || String(e) });
        }
      }

      processed++;
    } catch (e) {
      const msg = e?.message || String(e);
      const looksLikeTradeHold =
        String(msg).includes('Steam Guard') ||
        String(msg).toLowerCase().includes('not enabled') ||
        String(msg).toLowerCase().includes('cannot trade');
      await setClaimFailed(
        db,
        claimId,
        giveawayIdStr,
        steamId,
        looksLikeTradeHold ? 'Steam account cannot trade yet (Steam Guard hold)' : msg
      );
      processed++;
    }
  }

  if (!foundAny) {
    logDebug('[pending] no pending claims');
  }

  logDebug('[pending] scan complete', { processed });

  return processed;
}

async function pollSentOffersOnce(db, manager) {
  const claims = await db
    .collection('giveaway_claims')
    .find(
      {
        tradeStatus: 'SENT',
        steamTradeOfferId: { $exists: true, $ne: null },
      },
      { projection: { _id: 1, giveawayId: 1, steamId: 1, steamTradeOfferId: 1, updatedAt: 1, prizeStockId: 1 } }
    )
    .sort({ updatedAt: 1 })
    .limit(CONFIG.sentBatchSize)
    .toArray();

  if (!claims.length) {
    logDebug('[poll] no sent offers');
    return 0;
  }

  logDebug('[poll] checking offers', { count: claims.length });

  const E = TradeOfferManager.ETradeOfferState;
  let processed = 0;

  for (const c of claims) {
    const claimId = c._id;
    const steamId = String(c?.steamId || '').trim();
    const giveawayIdStr = String(c?.giveawayId || '').trim();
    const offerId = String(c?.steamTradeOfferId || '').trim();
    const prizeStockId = c?.prizeStockId || null;

    if (!offerId) continue;

    try {
      if (offerId === 'dry-run') {
        logInfo('[poll] dry-run complete', { giveawayId: giveawayIdStr, steamId, offerId });
        await setClaimSuccess(db, claimId, giveawayIdStr, steamId, offerId);
        processed++;
        continue;
      }

      const offer = await getOffer(manager, offerId);
      const state = offer?.state;

      logDebug('[poll] offer state', { giveawayId: giveawayIdStr, steamId, offerId, state });

      if (state === E.Accepted) {
        logInfo('[poll] offer accepted', { giveawayId: giveawayIdStr, steamId, offerId });
        await setClaimSuccess(db, claimId, giveawayIdStr, steamId, offerId);
        processed++;
        continue;
      }

      if (
        state === E.Declined ||
        state === E.Canceled ||
        state === E.Expired ||
        state === E.InvalidItems ||
        state === E.CanceledBySecondFactor
      ) {
        logInfo('[poll] offer failed', { giveawayId: giveawayIdStr, steamId, offerId, state });
        await setClaimFailed(db, claimId, giveawayIdStr, steamId, `Trade offer failed (state ${state})`, {
          steamTradeOfferState: state,
        });
        if (prizeStockId) {
          try {
            await db.collection('giveaway_prize_stock').updateOne(
              { _id: prizeStockId },
              {
                $set: { status: 'AVAILABLE', updatedAt: new Date() },
                $unset: {
                  reservedBySteamId: '',
                  reservedAt: '',
                  steamTradeOfferId: '',
                  sentAt: '',
                },
              }
            );
          } catch {
          }
        }
        processed++;
        continue;
      }

      await db.collection('giveaway_claims').updateOne(
        { _id: claimId },
        { $set: { lastSeenOfferState: state, updatedAt: new Date() } }
      );
    } catch (e) {
      await db.collection('giveaway_claims').updateOne(
        { _id: claimId },
        { $set: { lastError: e?.message || String(e), updatedAt: new Date() } }
      );
    }
  }

  return processed;
}

async function main() {
  console.log('[bot] starting', {
    pid: process.pid,
    mongoDbName: CONFIG.mongoDbName,
    appId: CONFIG.appId,
    contextId: CONFIG.contextId,
    pendingLoopMs: CONFIG.pendingLoopMs,
    pollLoopMs: CONFIG.pollLoopMs,
    dryRun: CONFIG.dryRun,
    verbose: CONFIG.verbose,
  });

  const { user, community, manager } = makeSteamClients();
  logOnSteam(user);

  let ready = false;
  const waitReady = () =>
    new Promise((resolve) => {
      const tick = () => {
        if (ready) return resolve();
        setTimeout(tick, 250);
      };
      tick();
    });

  manager.on('pollData', () => {
    // When pollData is available, cookies are set and manager is ready.
    ready = true;
  });

  await waitReady();

  logInfo('[bot] ready');

  if (CONFIG.exportInventory) {
    const appId = Number(CONFIG.exportInventoryAppId || CONFIG.appId);
    const contextId = String(CONFIG.exportInventoryContextId || CONFIG.contextId);
    const inventory = await getInventoryContents(manager, appId, contextId, true);
    const { total, matched, limited } = exportInventoryLines(inventory);

    logInfo('[export] inventory', {
      appId,
      contextId,
      total,
      matched,
      printed: limited.length,
      filter: CONFIG.exportInventoryFilter || null,
    });

    console.log('[export] copy/paste assetIds (one per line)');
    for (const r of limited) {
      console.log(r.assetId);
    }

    if (CONFIG.exportInventoryDetailed) {
      console.log('[export] detailed (assetId\tclassId\tinstanceId\tmarket_hash_name\tname)');
      for (const r of limited) {
        console.log([r.assetId, r.classId || '', r.instanceId || '', r.marketHashName || '', r.name || ''].join('\t'));
      }
    }

    try {
      user.logOff();
    } catch {
    }
    process.exit(0);
  }

  const { client, db } = await connectMongo();

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try {
      user.logOff();
    } catch {
      // ignore
    }
    try {
      await client.close();
    } catch {
      // ignore
    }
  };

  process.on('SIGINT', () => {
    stop().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    stop().finally(() => process.exit(0));
  });

  setInterval(() => {
    processPendingClaimsOnce(db, manager, community).catch((e) => {
      console.error('[pending] loop error', e);
    });
  }, CONFIG.pendingLoopMs);

  setInterval(() => {
    pollSentOffersOnce(db, manager).catch((e) => {
      console.error('[poll] loop error', e);
    });
  }, CONFIG.pollLoopMs);

  // Run one immediately
  await processPendingClaimsOnce(db, manager, community);
  await pollSentOffersOnce(db, manager);
}

main().catch((e) => {
  console.error('[bot] fatal', e);
  process.exit(1);
});

module.exports = { pollSentOffersOnce };
