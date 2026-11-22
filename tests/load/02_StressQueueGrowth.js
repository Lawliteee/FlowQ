// 400 одновременных пользователей, 2 очереди
// Каждый виртуальный пользователь в цикле:
// 1. открывает страницу очереди      
// 2. встаёт в очередь                
// 3. несколько раз обновляет состояние
// из очереди не выходим. 
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api';
const QUEUES = parseInt(__ENV.QUEUES || '2', 10);
const PEAK_VUS = parseInt(__ENV.PEAK_VUS || '400', 10);

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

const participantsJoined = new Counter('participants_joined');

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: Math.ceil(PEAK_VUS * 0.25) },
        { duration: '1m', target: Math.ceil(PEAK_VUS * 0.6) },
        { duration: '2m', target: PEAK_VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' },
    ],
    http_req_duration: ['p(95)<1000', 'p(99)<3000'],
    'http_req_duration{name:GET /queues/{id},qsize:lt100}': ['p(95)<1000'],
    'http_req_duration{name:GET /queues/{id},qsize:n100_499}': ['p(95)<1000'],
    'http_req_duration{name:GET /queues/{id},qsize:n500_1999}': ['p(95)<1000'],
    'http_req_duration{name:GET /queues/{id},qsize:n2000plus}': ['p(95)<1000'],
    'http_req_duration{name:POST /queues/{id}/join}': ['p(95)<1000'],
    checks: ['rate>0.95'],
  },
};

function sizeBucket(n) {
  if (n < 100) return 'lt100';
  if (n < 500) return 'n100_499';
  if (n < 2000) return 'n500_1999';
  return 'n2000plus';
}

function safeJson(res, selector) {
  try {
    return res.json(selector);
  } catch (e) {
    return undefined;
  }
}

export function setup() {
  const queueIds = [];

  for (let i = 0; i < QUEUES; i++) {
    const res = http.post(
      `${BASE_URL}/queues`,
      JSON.stringify({
        queueName: `k6-stress-${Date.now()}-${i}`,
        description: 'Очередь для стресс-теста',
        startTime: '',
        maxParticipants: 0, 
        hasPriority: false,
        priorityCount: 0,
        initialPriority: 0,
        skipFeature: false,
        skipDuration: 0,
        imFreeFeature: false,
        swapPositions: false,
        admins: [],
      }),
      { ...JSON_HEADERS, tags: { name: 'setup POST /queues' } },
    );

    const ok = check(res, {
      'setup: очередь создана (201)': (r) => r.status === 201,
    });
    if (!ok) {
      throw new Error(
        `Не удалось создать очередь: status=${res.status}. ` +
          `Проверьте, что бэкенд запущен на ${BASE_URL}`,
      );
    }
    queueIds.push(res.json('id'));
  }

  return { queueIds };
}

let lastKnownSize = 0;

function getQueue(queueUrl) {
  const res = http.get(queueUrl, {
    tags: {
      name: 'GET /queues/{id}',
      qsize: sizeBucket(lastKnownSize),
    },
  });

  const ok = check(res, {
    'GET queue: 200': (r) => r.status === 200,
  });

  if (ok) {
    const size = safeJson(res, 'peopleAhead');
    if (typeof size === 'number') {
      lastKnownSize = size;
    }
  }
  return res;
}

export default function (data) {
  const queueId = data.queueIds[(__VU - 1) % data.queueIds.length];
  const queueUrl = `${BASE_URL}/queues/${queueId}`;

  getQueue(queueUrl);
  sleep(Math.random() * 0.3 + 0.1);

  const joinRes = http.post(
    `${queueUrl}/join`,
    JSON.stringify({ name: `stress-${__VU}-${__ITER}` }),
    { ...JSON_HEADERS, tags: { name: 'POST /queues/{id}/join' } },
  );
  const joined = check(joinRes, {
    'join: 200': (r) => r.status === 200,
    'join: вернулся participantId': (r) => !!safeJson(r, 'participantId'),
  });
  if (joined) {
    participantsJoined.add(1);
  }

  sleep(Math.random() * 0.3 + 0.1);

  getQueue(queueUrl);
  sleep(Math.random() * 0.3 + 0.1);
  getQueue(queueUrl);
  sleep(Math.random() * 0.3 + 0.1);
}

export function teardown(data) {
  console.log(
    `Стресс-тест завершён. Очереди: ${data.queueIds.join(', ')}. ` +
      `Очистка: DELETE FROM queues WHERE name LIKE 'k6-stress-%';`,
  );
}
