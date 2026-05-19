/**
 * Azure Static Web Apps Serverless Function
 * Global Leaderboard API for BRIKX Game
 *
 * Endpoints:
 * GET  /api/leaderboard/get?limit=10&mode=classic&scope=weekly
 * POST /api/leaderboard/submit
 * GET  /api/leaderboard/player?name=PlayerName&mode=all&scope=monthly
 */

const crypto = require('crypto');
const { CosmosClient } = require('@azure/cosmos');

const ALLOWED_MODES = new Set(['classic', 'sprint', 'marathon']);
const ALLOWED_SCOPES = new Set(['all', 'weekly', 'monthly']);
const MAX_LEADERBOARD_FETCH = 100;
const PLAYER_HISTORY_LIMIT = 20;
const MAX_PROFILE_SNAPSHOT_SIZE = 120000;

// Anti-cheat hard limits.
const MAX_SCORE = 100000000;
const MAX_LINES = 5000;
const MAX_LEVEL = 500;
const MAX_SCORE_PER_LINE = 50000;
const MAX_SCORE_PER_SECOND = 20000;
const MAX_LINES_PER_SECOND = 8;
const MIN_HIGH_SCORE_DURATION_MS = 15000;

// Rate limiting windows for score submission.
const RATE_LIMIT_RULES = [
  { windowMs: 5 * 60 * 1000, max: 8 },
  { windowMs: 60 * 60 * 1000, max: 40 }
];

let containerPromise;

function normalizeMode(mode) {
  return ALLOWED_MODES.has(mode) ? mode : 'classic';
}

function normalizeScope(scope) {
  return ALLOWED_SCOPES.has(scope) ? scope : 'all';
}

function sanitizeName(name) {
  return (name || 'Player').toString().slice(0, 15).replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Player';
}

function sanitizeAvatar(avatar) {
  return typeof avatar === 'string' && avatar.trim() ? avatar.trim().slice(0, 8) : '🎮';
}

function parseBody(req) {
  if (!req?.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return {};
    }
  }
  if (typeof req.body === 'object') return req.body;
  return {};
}

function sanitizeProfileKey(profileKey) {
  const key = typeof profileKey === 'string' ? profileKey.trim().toLowerCase() : '';
  if (!/^[a-f0-9]{32,64}$/.test(key)) {
    return '';
  }
  return key;
}

function normalizeProfileSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return null;
  }

  let encoded;
  try {
    encoded = JSON.stringify(snapshot);
  } catch (error) {
    return null;
  }

  if (!encoded || encoded.length > MAX_PROFILE_SNAPSHOT_SIZE) {
    return null;
  }

  return JSON.parse(encoded);
}

function getScopeStartIso(scope, now = new Date()) {
  if (scope === 'all') return null;

  if (scope === 'monthly') {
    const monthlyStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    return monthlyStart.toISOString();
  }

  const weeklyStart = new Date(now);
  const utcDay = weeklyStart.getUTCDay();
  const daysSinceMonday = (utcDay + 6) % 7;
  weeklyStart.setUTCDate(weeklyStart.getUTCDate() - daysSinceMonday);
  weeklyStart.setUTCHours(0, 0, 0, 0);
  return weeklyStart.toISOString();
}

function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'] || req?.headers?.['X-Forwarded-For'] || '';
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req?.headers?.['x-client-ip'] || req?.headers?.['X-Client-IP'] || req?.ip || 'unknown';
}

function createRateLimitKey(req, deviceId = 'unknown') {
  const ip = getClientIp(req);
  const userAgent = req?.headers?.['user-agent'] || req?.headers?.['User-Agent'] || 'ua';
  const raw = `${ip}|${deviceId}|${userAgent}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 28);
}

function mapScoreEntry(entry) {
  return {
    id: entry.id,
    name: entry.name,
    avatar: entry.avatar,
    score: entry.score,
    lines: entry.lines,
    level: entry.level,
    mode: entry.mode,
    date: entry.submittedAt,
    submittedAt: entry.submittedAt
  };
}

function normalizeScoreEntry(rawEntry) {
  const nowIso = new Date().toISOString();
  const score = Math.max(0, Number.parseInt(rawEntry?.score, 10) || 0);
  const lines = Math.max(0, Number.parseInt(rawEntry?.lines, 10) || 0);
  const level = Math.max(1, Number.parseInt(rawEntry?.level, 10) || 1);
  const durationMs = Math.max(0, Number.parseInt(rawEntry?.durationMs, 10) || 0);

  return {
    id: `score_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`,
    docType: 'score',
    name: sanitizeName(rawEntry?.name),
    avatar: sanitizeAvatar(rawEntry?.avatar),
    score,
    lines,
    level,
    mode: normalizeMode(rawEntry?.mode),
    deviceId: typeof rawEntry?.deviceId === 'string' ? rawEntry.deviceId.slice(0, 60) : 'unknown',
    durationMs,
    submittedAt: nowIso,
    createdAt: nowIso
  };
}

function validateAgainstAntiCheat(entry) {
  const violations = [];

  if (entry.score <= 0) violations.push('Score must be greater than zero.');
  if (entry.score > MAX_SCORE) violations.push('Score exceeds allowed maximum.');
  if (entry.lines > MAX_LINES) violations.push('Line count exceeds allowed maximum.');
  if (entry.level > MAX_LEVEL) violations.push('Level exceeds allowed maximum.');
  if (entry.score === 0 && entry.lines === 0) violations.push('Score and lines cannot both be zero.');

  if (entry.lines > 0 && entry.score / entry.lines > MAX_SCORE_PER_LINE) {
    violations.push('Score per line is outside valid range.');
  }

  if (entry.durationMs > 0) {
    const durationSeconds = entry.durationMs / 1000;
    if (durationSeconds > 0 && entry.score / durationSeconds > MAX_SCORE_PER_SECOND) {
      violations.push('Score velocity exceeds valid threshold.');
    }
    if (durationSeconds > 0 && entry.lines / durationSeconds > MAX_LINES_PER_SECOND) {
      violations.push('Line clear velocity exceeds valid threshold.');
    }
  }

  if (entry.score >= 5000 && entry.durationMs > 0 && entry.durationMs < MIN_HIGH_SCORE_DURATION_MS) {
    violations.push('High score submitted too quickly.');
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

async function getContainer() {
  if (!containerPromise) {
    containerPromise = (async () => {
      const endpoint = process.env.COSMOSDB_ENDPOINT;
      const key = process.env.COSMOSDB_KEY;
      const databaseId = process.env.COSMOSDB_DATABASE || 'brikx';
      const containerId = process.env.COSMOSDB_CONTAINER || 'leaderboard';

      if (!endpoint || !key) {
        throw new Error('Cosmos DB is not configured. Set COSMOSDB_ENDPOINT and COSMOSDB_KEY.');
      }

      const client = new CosmosClient({ endpoint, key });
      const { database } = await client.databases.createIfNotExists({ id: databaseId });
      const { container } = await database.containers.createIfNotExists({
        id: containerId,
        partitionKey: { paths: ['/docType'] },
        defaultTtl: -1
      });

      return container;
    })();
  }

  return containerPromise;
}

async function enforceRateLimit(container, req, entry) {
  const now = Date.now();
  const rateKey = createRateLimitKey(req, entry.deviceId);

  for (const rule of RATE_LIMIT_RULES) {
    const bucket = Math.floor(now / rule.windowMs);
    const id = `rate:${rateKey}:${rule.windowMs}:${bucket}`;
    const ttlSeconds = Math.ceil(rule.windowMs / 1000) + 60;

    try {
      const { resource } = await container.item(id, 'rate').read();
      const currentCount = Number.parseInt(resource?.count, 10) || 0;
      if (currentCount >= rule.max) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(((bucket + 1) * rule.windowMs - now) / 1000)
        };
      }

      await container.item(id, 'rate').replace({
        ...resource,
        count: currentCount + 1,
        ttl: ttlSeconds,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (error.code !== 404) {
        throw error;
      }

      await container.items.create({
        id,
        docType: 'rate',
        key: rateKey,
        windowMs: rule.windowMs,
        bucket,
        count: 1,
        ttl: ttlSeconds,
        createdAt: new Date().toISOString()
      });
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

function buildScoreFilters({ mode, scope, name }) {
  const startIso = getScopeStartIso(scope);
  const conditions = [`c.docType = 'score'`];
  const parameters = [];

  if (mode !== 'all') {
    conditions.push('c.mode = @mode');
    parameters.push({ name: '@mode', value: mode });
  }

  if (name) {
    conditions.push('c.name = @name');
    parameters.push({ name: '@name', value: sanitizeName(name) });
  }

  if (startIso) {
    conditions.push('c.submittedAt >= @startIso');
    parameters.push({ name: '@startIso', value: startIso });
  }

  return { where: conditions.join(' AND '), parameters };
}

async function runQuery(container, query, parameters = []) {
  const { resources } = await container.items
    .query({ query, parameters }, { enableCrossPartitionQuery: true })
    .fetchAll();
  return resources;
}

async function handleGet(req, container) {
  const limit = Math.min(Math.max(Number.parseInt(req?.query?.limit, 10) || 10, 1), MAX_LEADERBOARD_FETCH);
  const mode = req?.query?.mode === 'all' ? 'all' : normalizeMode(req?.query?.mode);
  const scope = normalizeScope(req?.query?.scope || 'all');

  const filters = buildScoreFilters({ mode, scope });
  const params = [...filters.parameters, { name: '@limit', value: limit }];

  const entries = await runQuery(
    container,
    `SELECT TOP @limit c.id, c.name, c.avatar, c.score, c.lines, c.level, c.mode, c.submittedAt
     FROM c
     WHERE ${filters.where}
     ORDER BY c.score DESC, c.lines DESC, c.submittedAt DESC`,
    params
  );

  const totalRows = await runQuery(
    container,
    `SELECT VALUE COUNT(1) FROM c WHERE ${filters.where}`,
    filters.parameters
  );
  const total = totalRows[0] || 0;

  return {
    status: 200,
    body: {
      success: true,
      entries: entries.map(mapScoreEntry),
      total,
      mode,
      scope,
      timestamp: new Date().toISOString()
    }
  };
}

async function handleSubmit(req, container) {
  const payload = parseBody(req);
  const entry = normalizeScoreEntry(payload);

  const antiCheat = validateAgainstAntiCheat(entry);
  if (!antiCheat.valid) {
    return {
      status: 422,
      body: {
        success: false,
        error: 'Score rejected by anti-cheat validation.',
        violations: antiCheat.violations
      }
    };
  }

  const rateLimit = await enforceRateLimit(container, req, entry);
  if (!rateLimit.allowed) {
    return {
      status: 429,
      body: {
        success: false,
        error: 'Too many score submissions. Please wait before submitting again.',
        retryAfterSeconds: rateLimit.retryAfterSeconds
      }
    };
  }

  await container.items.create(entry);

  const rankRows = await runQuery(
    container,
    `SELECT VALUE COUNT(1)
     FROM c
     WHERE c.docType = 'score'
       AND c.mode = @mode
       AND (
         c.score > @score
         OR (c.score = @score AND c.lines > @lines)
         OR (c.score = @score AND c.lines = @lines AND c.submittedAt > @submittedAt)
       )`,
    [
      { name: '@mode', value: entry.mode },
      { name: '@score', value: entry.score },
      { name: '@lines', value: entry.lines },
      { name: '@submittedAt', value: entry.submittedAt }
    ]
  );

  const rank = (rankRows[0] || 0) + 1;

  return {
    status: 200,
    body: {
      success: true,
      message: 'Score submitted successfully',
      rank,
      entry: mapScoreEntry(entry),
      timestamp: new Date().toISOString()
    }
  };
}

async function handlePlayer(req, container) {
  const playerName = sanitizeName(req?.query?.name);
  const mode = req?.query?.mode === 'all' ? 'all' : normalizeMode(req?.query?.mode);
  const scope = normalizeScope(req?.query?.scope || 'all');

  if (!playerName) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Player name is required'
      }
    };
  }

  const filters = buildScoreFilters({ mode, scope, name: playerName });
  const playerEntries = await runQuery(
    container,
    `SELECT TOP ${PLAYER_HISTORY_LIMIT} c.id, c.name, c.avatar, c.score, c.lines, c.level, c.mode, c.submittedAt
     FROM c
     WHERE ${filters.where}
     ORDER BY c.score DESC, c.lines DESC, c.submittedAt DESC`,
    filters.parameters
  );

  const bestEntry = playerEntries[0] || null;
  let rank = null;

  if (bestEntry) {
    const globalFilters = buildScoreFilters({ mode, scope });
    const rankParams = [
      ...globalFilters.parameters,
      { name: '@score', value: bestEntry.score },
      { name: '@lines', value: bestEntry.lines },
      { name: '@submittedAt', value: bestEntry.submittedAt }
    ];

    const rankWhere = `${globalFilters.where} AND (
      c.score > @score
      OR (c.score = @score AND c.lines > @lines)
      OR (c.score = @score AND c.lines = @lines AND c.submittedAt > @submittedAt)
    )`;

    const rankRows = await runQuery(
      container,
      `SELECT VALUE COUNT(1) FROM c WHERE ${rankWhere}`,
      rankParams
    );
    rank = (rankRows[0] || 0) + 1;
  }

  return {
    status: 200,
    body: {
      success: true,
      player: playerName,
      bestEntry: bestEntry ? mapScoreEntry(bestEntry) : null,
      rank,
      totalSubmissions: playerEntries.length,
      allEntries: playerEntries.map(mapScoreEntry),
      mode,
      scope,
      timestamp: new Date().toISOString()
    }
  };
}

async function handleProfileSave(req, container) {
  const payload = parseBody(req);
  const profileKey = sanitizeProfileKey(payload?.profileKey);
  const snapshot = normalizeProfileSnapshot(payload?.snapshot);

  if (!profileKey) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'A valid profile key is required.'
      }
    };
  }

  if (!snapshot) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'A valid profile snapshot is required.'
      }
    };
  }

  const id = `profile:${profileKey}`;
  const nowIso = new Date().toISOString();

  const nextDoc = {
    id,
    docType: 'profile',
    profileKey,
    snapshot,
    updatedAt: nowIso,
    createdAt: nowIso
  };

  try {
    const { resource } = await container.item(id, 'profile').read();
    await container.item(id, 'profile').replace({
      ...resource,
      profileKey,
      snapshot,
      updatedAt: nowIso
    });
  } catch (error) {
    if (error.code !== 404) throw error;
    await container.items.create(nextDoc);
  }

  return {
    status: 200,
    body: {
      success: true,
      updatedAt: nowIso
    }
  };
}

async function handleProfileLoad(req, container) {
  const payload = parseBody(req);
  const keyFromQuery = sanitizeProfileKey(req?.query?.profileKey);
  const keyFromBody = sanitizeProfileKey(payload?.profileKey);
  const profileKey = keyFromQuery || keyFromBody;

  if (!profileKey) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'A valid profile key is required.'
      }
    };
  }

  const id = `profile:${profileKey}`;

  try {
    const { resource } = await container.item(id, 'profile').read();
    if (!resource?.snapshot) {
      return {
        status: 404,
        body: {
          success: false,
          error: 'Profile snapshot not found.'
        }
      };
    }

    return {
      status: 200,
      body: {
        success: true,
        snapshot: resource.snapshot,
        updatedAt: resource.updatedAt || resource.createdAt || new Date().toISOString()
      }
    };
  } catch (error) {
    if (error.code === 404) {
      return {
        status: 404,
        body: {
          success: false,
          error: 'Profile snapshot not found.'
        }
      };
    }
    throw error;
  }
}

module.exports = async function (context, req) {
  context.res = context.res || { headers: {} };
  context.res.headers = context.res.headers || {};

  context.res.headers['Access-Control-Allow-Origin'] = '*';
  context.res.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  context.res.headers['Access-Control-Allow-Headers'] = 'Content-Type';

  if (req.method === 'OPTIONS') {
    context.res.status = 204;
    return;
  }

  const action = req?.params?.action;

  try {
    const container = await getContainer();
    let result;

    if (req.method === 'GET' && action === 'get') {
      result = await handleGet(req, container);
    } else if (req.method === 'POST' && action === 'submit') {
      result = await handleSubmit(req, container);
    } else if (req.method === 'GET' && action === 'player') {
      result = await handlePlayer(req, container);
    } else if (req.method === 'POST' && action === 'profile-save') {
      result = await handleProfileSave(req, container);
    } else if ((req.method === 'POST' || req.method === 'GET') && action === 'profile-load') {
      result = await handleProfileLoad(req, container);
    } else {
      result = {
        status: 404,
        body: {
          success: false,
          error: 'Endpoint not found'
        }
      };
    }

    context.res.status = result.status;
    context.res.body = result.body;
  } catch (error) {
    console.error('Leaderboard API error:', error);
    context.res.status = 500;
    context.res.body = {
      success: false,
      error: 'Internal server error',
      details: error.message
    };
  }
};
