// 100 одновременных пользователей, 2 очереди (по ~50 в каждой комнате)
// Каждый виртуальный пользователь в цикле:
// 1. встаёт в очередь (HTTP)
// 2. открывает WebSocket-соединение к своей очереди
// 3. 30-60 секунд держит соединение: раз в 3-6 секунд пишет в чат, принимает сообщения чата и обновления очереди от остальных
// 4. закрывает соединение и выходит из очереди.
import http from 'k6/http';
import { WebSocket } from 'k6/websockets';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080/api';
const WS_URL = BASE_URL.replace(/^http/, 'ws');
const QUEUES = parseInt(__ENV.QUEUES || '2', 10);
const PEAK_VUS = parseInt(__ENV.PEAK_VUS || '100', 10);

const SESSION_MIN_MS = 30000; 
const SESSION_MAX_MS = 60000; 

const JSON_HEADERS = { headers: { 'Content-Type': 'application/json' } };

const chatRoundtrip = new Trend('chat_roundtrip_ms', true);
const wsUnexpectedClose = new Counter('ws_unexpected_close');
const wsErrors = new Counter('ws_errors');
const msgQueueUpdate = new Counter('msg_queue_update');
const msgChat = new Counter('msg_chat_message');

export const options = {
  scenarios: {
    websocket_clients: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Math.ceil(PEAK_VUS / 2) },
        { duration: '1m', target: PEAK_VUS },
        { duration: '2m', target: PEAK_VUS },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '70s',
      gracefulStop: '70s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    ws_unexpected_close: ['count==0'],
    ws_errors: ['count==0'],
    ws_connecting: ['p(95)<1000'],
    chat_roundtrip_ms: ['p(95)<500', 'p(99)<1500'],
    checks: ['rate>0.99'],
  },
};

function randomMs(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

export function setup() {
  const queueIds = [];

  for (let i = 0; i < QUEUES; i++) {
    const res = http.post(
      `${BASE_URL}/queues`,
      JSON.stringify({
        queueName: `k6-ws-${Date.now()}-${i}`,
        description: 'Очередь для WebSocket-теста',
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

  const joinRes = http.post(
    `${queueUrl}/join`,
    JSON.stringify({ name: `ws-user-${__VU}-${__ITER}` }),
    { ...JSON_HEADERS, tags: { name: 'POST /queues/{id}/join' } },
  );
  const joined = check(joinRes, {
    'join: 200': (r) => r.status === 200,
  });
  let participantId = null;
  if (joined) {
    try {
      participantId = joinRes.json('participantId');
    } catch (e) {
      participantId = null;
    }
  }
  if (!participantId) {
    sleep(1); 
    return;
  }

  const wsUrl =
    `${WS_URL}/ws/queue/${queueId}` +
    `?participantId=${participantId}&senderName=ws-user-${__VU}`;

  const ws = new WebSocket(wsUrl);

  let opened = false;
  let closingByUs = false;
  let finished = false; 
  let sent = 0;
  let echoed = 0;
  let chatTimer = null;

  ws.onopen = () => {
    opened = true;

    chatTimer = setInterval(() => {
      ws.send(JSON.stringify({ type: 'chat_message', text: `ping:${Date.now()}` }));
      sent++;
    }, randomMs(3000, 6000));

    setTimeout(() => {
      closingByUs = true;
      clearInterval(chatTimer);
      ws.close();
    }, randomMs(SESSION_MIN_MS, SESSION_MAX_MS));
  };

  ws.onmessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch (e) {
      return; 
    }

    if (msg.type === 'queue_update') {
      msgQueueUpdate.add(1);
    } else if (msg.type === 'chat_message') {
      msgChat.add(1);
      if (msg.senderId === participantId && typeof msg.text === 'string') {
        const sentAt = parseInt(msg.text.split(':')[1], 10);
        if (!isNaN(sentAt)) {
          chatRoundtrip.add(Date.now() - sentAt);
          echoed++;
        }
      }
    }
  };

  ws.onerror = () => {
    wsErrors.add(1);
  };

  ws.onclose = () => {
    if (finished) return;
    finished = true;
    clearInterval(chatTimer);

    if (opened && !closingByUs) {
      wsUnexpectedClose.add(1);
    }

    check(null, {
      'ws: соединение установлено': () => opened,
      'ws: свои сообщения вернулись через рассылку': () => echoed >= sent - 1,
    });

    const leaveRes = http.del(`${queueUrl}/participants/${participantId}`, null, {
      tags: { name: 'DELETE /queues/{id}/participants/{pid}' },
    });
    check(leaveRes, { 'leave: 200': (r) => r.status === 200 });
  };
}

export function teardown(data) {
  console.log(
    `WebSocket-тест завершён. Очереди: ${data.queueIds.join(', ')}. ` +
      `Очистка: DELETE FROM queues WHERE name LIKE 'k6-ws-%';`,
  );
}
