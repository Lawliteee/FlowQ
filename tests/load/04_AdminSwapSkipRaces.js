// 32 одновременных пользователя, 2 сценария (race и private_flows)
// Виртуальные пользователи проверяют:
// 1. организатор и участники параллельно вызывают следующего (next / im-free) и пропускают очередь (skip)
// 2. операции с очередью: пропуск (skip), возврат (return), вызов следующего (next) и обмен местами (swap через WebSocket)
// 3. проверку прав доступа к админ-панели и отсутствие логических нарушений (logic_violations = 0)
import http from 'k6/http';
import { WebSocket } from 'k6/websockets';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api';
const WS_URL = BASE_URL.replace(/^http/, 'ws');
const RACE_QUEUES = parseInt(__ENV.RACE_QUEUES || '2', 10);
const RACE_PARTICIPANTS = parseInt(__ENV.RACE_PARTICIPANTS || '1000', 10);
const RACE_VUS = parseInt(__ENV.RACE_VUS || '12', 10);
const PRIV_VUS = parseInt(__ENV.PRIV_VUS || '20', 10);
const PRIV_SIZE = Math.max(4, parseInt(__ENV.PRIV_SIZE || '6', 10));
const PRIV_DURATION = __ENV.PRIV_DURATION || '60s';

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

const logicViolations = new Counter('logic_violations');
const swapTimeouts = new Counter('swap_request_timeouts');
const swapWsErrors = new Counter('swap_ws_errors');
const nextServed = new Counter('next_served_ok');

export const options = {
  setupTimeout: '180s',
  teardownTimeout: '60s',
  scenarios: {
    race: {
      executor: 'constant-vus',
      exec: 'raceFlow',
      vus: RACE_VUS,
      duration: '20s',
      startTime: '10s',
    },
    private_flows: {
      executor: 'constant-vus',
      exec: 'privateFlow',
      vus: PRIV_VUS,
      duration: PRIV_DURATION,
      gracefulStop: '30s',
    },
  },
  thresholds: {
    logic_violations: ['count==0'],
    swap_request_timeouts: ['count==0'],
    swap_ws_errors: ['count==0'],
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    'http_req_duration{name:POST /admin/queues/{id}/next}': ['p(95)<800'],
  },
};

function expect(name, condition) {
  const ok = check(null, { [name]: () => condition });
  if (!ok) {
    logicViolations.add(1, { rule: name });
  }
  return ok;
}

function queueBody(name) {
  return {
    queueName: name,
    description: 'Очередь для теста организатора и гонок',
    startTime: '',
    maxParticipants: 0,
    hasPriority: false,
    priorityCount: 0,
    initialPriority: 0,
    skipFeature: true,
    skipDuration: 10,
    imFreeFeature: true,
    swapPositions: true,
    admins: [],
  };
}

function getState(queueUrl) {
  const res = http.get(queueUrl, { tags: { name: 'GET /queues/{id}' } });
  if (!expect('GET queue: 200', res.status === 200)) {
    return null;
  }
  try {
    const body = res.json();
    const participants = Array.isArray(body.participants) ? body.participants : [];
    return {
      order: participants.map((p) => p.id),
      currentNumber: body.currentNumber,
    };
  } catch (e) {
    expect('GET queue: корректный JSON', false);
    return null;
  }
}

export function setup() {
  const reg = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email: `k6-admin-${Date.now()}@example.com`,
      password: 'k6-password-123',
      displayName: 'k6 admin',
    }),
    { ...JSON_HEADERS, tags: { name: 'setup POST /auth/register' } },
  );
  if (reg.status !== 201) {
    throw new Error(
      `Не удалось зарегистрировать администратора: status=${reg.status}. ` +
        `Проверьте, что бэкенд запущен на ${BASE_URL}`,
    );
  }
  const token = reg.json('token');

  const raceQueues = [];
  for (let i = 0; i < RACE_QUEUES; i++) {
    const created = http.post(
      `${BASE_URL}/queues`,
      JSON.stringify(queueBody(`k6-admin-race-${Date.now()}-${i}`)),
      { ...JSON_HEADERS, tags: { name: 'setup POST /queues' } },
    );
    if (created.status !== 201) {
      throw new Error(`Не удалось создать очередь: status=${created.status}`);
    }
    const id = created.json('id');

    const ids = [];
    for (let start = 0; start < RACE_PARTICIPANTS; start += 100) {
      const requests = [];
      const end = Math.min(start + 100, RACE_PARTICIPANTS);
      for (let j = start; j < end; j++) {
        requests.push([
          'POST',
          `${BASE_URL}/queues/${id}/join`,
          JSON.stringify({ name: `race-${i}-${j}` }),
          { ...JSON_HEADERS, tags: { name: 'setup POST join' } },
        ]);
      }
      const responses = http.batch(requests);
      for (const r of responses) {
        if (r.status !== 200) {
          throw new Error(`Не удалось добавить участника в setup: status=${r.status}`);
        }
        ids.push(r.json('participantId'));
      }
    }
    raceQueues.push({ id, initial: ids.length, ids });
  }

  return { token, raceQueues };
}

export function raceFlow(data) {
  const q = data.raceQueues[__VU % data.raceQueues.length];
  const role = __VU % 3;

  if (role === 0) {
    const res = http.post(`${BASE_URL}/admin/queues/${q.id}/next`, null, {
      headers: { Authorization: `Bearer ${data.token}` },
      tags: { name: 'POST /admin/queues/{id}/next' },
      responseCallback: http.expectedStatuses({ min: 200, max: 299 }, 400),
    });
    if (res.status === 200) {
      nextServed.add(1);
    }
  } else if (role === 1) {
    http.post(`${BASE_URL}/queues/${q.id}/im-free`, null, {
      tags: { name: 'POST /queues/{id}/im-free' },
    });
  } else {
    const pid = q.ids[Math.floor(Math.random() * q.ids.length)];
    http.post(`${BASE_URL}/queues/${q.id}/skip`, JSON.stringify({ participantId: pid }), {
      ...JSON_HEADERS,
      tags: { name: 'POST /queues/{id}/skip' },
    });
  }

  sleep(0.02);
}

let priv = null;

function initPrivate() {
  const res = http.post(
    `${BASE_URL}/queues`,
    JSON.stringify(queueBody(`k6-admin-priv-${Date.now()}-${__VU}`)),
    { ...JSON_HEADERS, tags: { name: 'POST /queues' } },
  );
  if (!expect('private: очередь создана (201)', res.status === 201)) {
    return false;
  }
  const queueId = res.json('id');
  const queueUrl = `${BASE_URL}/queues/${queueId}`;

  for (let i = 0; i < PRIV_SIZE; i++) {
    const j = http.post(`${queueUrl}/join`, JSON.stringify({ name: `priv-${__VU}-${i}` }), {
      ...JSON_HEADERS,
      tags: { name: 'POST /queues/{id}/join' },
    });
    expect('private: join 200', j.status === 200);
  }

  priv = { queueId, queueUrl };
  return true;
}

export function privateFlow(data) {
  if (!priv && !initPrivate()) {
    sleep(1);
    return;
  }
  const { queueId, queueUrl } = priv;
  const authHeaders = { Authorization: `Bearer ${data.token}` };

  sleep(0.2);

  const s0 = getState(queueUrl);
  if (!s0 || s0.order.length < 4) {
    sleep(1);
    return;
  }
  const k = Math.floor(Math.random() * (s0.order.length - 1));
  const pid = s0.order[k];

  const skipRes = http.post(`${queueUrl}/skip`, JSON.stringify({ participantId: pid }), {
    ...JSON_HEADERS,
    tags: { name: 'POST /queues/{id}/skip' },
  });
  expect('skip: 200', skipRes.status === 200);

  const s1 = getState(queueUrl);
  if (s1) {
    expect('skip: участник ушёл в конец очереди', s1.order[s1.order.length - 1] === pid);
    const rest = s0.order.filter((id) => id !== pid);
    expect(
      'skip: порядок остальных не изменился',
      s1.order.slice(0, -1).join() === rest.join(),
    );
  }

  const retRes = http.post(`${queueUrl}/return`, JSON.stringify({ participantId: pid }), {
    ...JSON_HEADERS,
    tags: { name: 'POST /queues/{id}/return' },
  });
  expect('return: 200', retRes.status === 200);

  const s2 = getState(queueUrl);
  if (s2) {
    expect(
      'return: в очереди те же участники',
      s2.order.slice().sort().join() === s0.order.slice().sort().join(),
    );
    expect('return: участник не позже прежнего места', s2.order.indexOf(pid) <= k);
  }

  const s3 = getState(queueUrl);
  if (s3 && s3.order.length > 0) {
    const nextRes = http.post(`${BASE_URL}/admin/queues/${queueId}/next`, null, {
      headers: authHeaders,
      tags: { name: 'POST /admin/queues/{id}/next' },
    });
    if (expect('next: 200', nextRes.status === 200)) {
      let body = null;
      try {
        body = nextRes.json();
      } catch (e) {
        body = null;
      }
      if (expect('next: корректный JSON', body !== null)) {
        const left = Array.isArray(body.participants) ? body.participants.map((p) => p.id) : [];
        expect('next: currentNumber вырос на 1', body.currentNumber === s3.currentNumber + 1);
        expect(
          'next: вызван первый в очереди',
          !!body.currentParticipant && body.currentParticipant.id === s3.order[0],
        );
        expect(
          'next: очередь уменьшилась на одного, порядок сохранён',
          left.join() === s3.order.slice(1).join(),
        );
      }
    }

    const rj = http.post(`${queueUrl}/join`, JSON.stringify({ name: `priv-${__VU}-${__ITER}` }), {
      ...JSON_HEADERS,
      tags: { name: 'POST /queues/{id}/join' },
    });
    expect('private: join после next 200', rj.status === 200);
  }

  const mine = http.get(`${BASE_URL}/admin/users/me/queues`, {
    headers: authHeaders,
    tags: { name: 'GET /admin/users/me/queues' },
  });
  expect('admin/users/me/queues: 200 с токеном', mine.status === 200);

  const noAuth = http.get(`${BASE_URL}/admin/users/me/queues`, {
    tags: { name: 'GET /admin/users/me/queues (без токена)' },
    responseCallback: http.expectedStatuses(401),
  });
  expect('admin/users/me/queues: 401 без токена', noAuth.status === 401);

  const s4 = getState(queueUrl);
  if (s4 && s4.order.length >= 2) {
    swapStep(queueId, queueUrl, s4.order);
  }
}

function swapStep(queueId, queueUrl, order) {
  const n = order.length;
  const ia = Math.floor(Math.random() * n);
  let ib = Math.floor(Math.random() * n);
  if (ib === ia) {
    ib = (ia + 1) % n;
  }
  const a = order[ia];
  const b = order[ib];

  const ws = new WebSocket(
    `${WS_URL}/ws/queue/${queueId}?participantId=${b}&senderName=swap-b`,
  );

  let swapDone = false;
  let requestTimer = null;
  let timeoutTimer = null;

  ws.onopen = () => {
    requestTimer = setTimeout(() => {
      const r = http.post(
        `${queueUrl}/swap/request`,
        JSON.stringify({ fromId: a, fromName: 'swap-a', toId: b }),
        { ...JSON_HEADERS, tags: { name: 'POST /queues/{id}/swap/request' } },
      );
      expect('swap/request: 200', r.status === 200);
    }, 200);

    timeoutTimer = setTimeout(() => {
      if (!swapDone) {
        swapTimeouts.add(1);
        ws.close();
      }
    }, 5000);
  };

  ws.onmessage = (event) => {
    if (swapDone) return;
    const raw = event.data;
    if (typeof raw !== 'string' || !raw.includes('"type":"swap_request"')) return;

    let msg = null;
    try {
      msg = JSON.parse(raw);
    } catch (e) {
      msg = null;
    }
    if (!msg || !msg.swapId) return;
    swapDone = true;

    const respond = http.post(
      `${queueUrl}/swap/respond`,
      JSON.stringify({ swapId: msg.swapId, accept: true }),
      { ...JSON_HEADERS, tags: { name: 'POST /queues/{id}/swap/respond' } },
    );
    expect('swap/respond: 200', respond.status === 200);

    const after = getState(queueUrl);
    if (after) {
      const expected = order.slice();
      expected[ia] = b;
      expected[ib] = a;
      expect('swap: места обменялись ровно, остальные на месте', after.order.join() === expected.join());
    }
    ws.close();
  };

  ws.onerror = () => {
    swapWsErrors.add(1);
  };

  ws.onclose = () => {
    clearTimeout(requestTimer);
    clearTimeout(timeoutTimer);
  };
}

export function teardown(data) {
  for (const q of data.raceQueues) {
    const res = http.get(`${BASE_URL}/queues/${q.id}`, {
      tags: { name: 'teardown GET /queues/{id}' },
    });
    if (res.status !== 200) {
      logicViolations.add(1, { rule: 'teardown: не удалось прочитать очередь' });
      continue;
    }

    const body = res.json();
    const remaining = Array.isArray(body.participants) ? body.participants.length : 0;
    const removed = q.initial - remaining;
    const diff = body.currentNumber - removed;

    console.log(
      `Гонка, очередь ${q.id}: было ${q.initial}, осталось ${remaining}, ` +
        `убрано ${removed}, currentNumber=${body.currentNumber}, расхождение=${diff}`,
    );

    if (diff !== 0) {
      logicViolations.add(Math.abs(diff), {
        rule: 'race: currentNumber не равен числу убранных участников',
      });
    }
  }

  console.log(
    `Тест завершён. Очистка: DELETE FROM queues WHERE name LIKE 'k6-admin-%'; ` +
      `DELETE FROM users WHERE email LIKE 'k6-admin-%';`,
  );
}
