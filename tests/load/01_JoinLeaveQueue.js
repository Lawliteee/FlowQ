// 50 пользователей, 5 очередей
// Каждый виртуальный пользователь в цикле:
// 1. открывает страницу очереди      
// 2. встаёт в очередь                
// 3. несколько раз обновляет состояние
// 4. выходит из очереди      
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api';
const QUEUES = parseInt(__ENV.QUEUES || '5', 10);
const PEAK_VUS = parseInt(__ENV.PEAK_VUS || '50', 10);

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

export const options = {
  scenarios: {
    participants: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(PEAK_VUS / 2) },
        { duration: '1m', target: PEAK_VUS },             
        { duration: '2m', target: PEAK_VUS },                
        { duration: '30s', target: 0 },                 
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name:GET /queues/{id}}': ['p(95)<400'],
    'http_req_duration{name:POST /queues/{id}/join}': ['p(95)<600'],
    'http_req_duration{name:DELETE /queues/{id}/participants/{pid}}': ['p(95)<600'],
    checks: ['rate>0.99'],
  },
};

export function setup() {
  const queueIds = [];

  for (let i = 0; i < QUEUES; i++) {
    const res = http.post(
      `${BASE_URL}/queues`,
      JSON.stringify({
        queueName: `k6-load-${Date.now()}-${i}`,
        description: 'Очередь для нагрузочного теста',
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

export default function (data) {
  const queueId = data.queueIds[(__VU - 1) % data.queueIds.length];
  const queueUrl = `${BASE_URL}/queues/${queueId}`;

  let participantId = null;

  group('Открыть страницу очереди', () => {
    const res = http.get(queueUrl, { tags: { name: 'GET /queues/{id}' } });
    check(res, {
      'GET queue: 200': (r) => r.status === 200,
      'GET queue: есть поле participants': (r) =>
        Array.isArray(r.json('participants')),
    });
  });

  sleep(Math.random() * 2 + 1); 

  group('Встать в очередь', () => {
    const res = http.post(
      `${queueUrl}/join`,
      JSON.stringify({ name: `user-${__VU}-${__ITER}` }),
      { ...JSON_HEADERS, tags: { name: 'POST /queues/{id}/join' } },
    );
    const ok = check(res, {
      'join: 200': (r) => r.status === 200,
      'join: вернулся participantId': (r) => !!r.json('participantId'),
      'join: position >= 1': (r) => r.json('position') >= 1,
    });
    if (ok) {
      participantId = res.json('participantId');
    }
  });


  if (!participantId) {
    sleep(1);
    return;
  }

  group('Следить за очередью', () => {
    const polls = 3 + Math.floor(Math.random() * 3); 
    for (let i = 0; i < polls; i++) {
      sleep(Math.random() * 2 + 2); 

      const res = http.get(queueUrl, { tags: { name: 'GET /queues/{id}' } });
      check(res, {
        'poll: 200': (r) => r.status === 200,
        'poll: участник на месте в очереди': (r) => {
          const list = r.json('participants') || [];
          return list.some((p) => p.id === participantId);
        },
      });
    }
  });

  group('Выйти из очереди', () => {
    const res = http.del(`${queueUrl}/participants/${participantId}`, null, {
      tags: { name: 'DELETE /queues/{id}/participants/{pid}' },
    });
    check(res, {
      'leave: 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1); 
}

export function teardown(data) {
  console.log(
    `Тест завершён. Созданные очереди: ${data.queueIds.join(', ')}`,
  );
}
