import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080/api';
const WS_BASE_URL = process.env.WS_URL || 'ws://localhost:8080/api/ws/queue';

function randomQueueName(prefix = 'Интеграционная очередь') {
  const rand = Math.random().toString(36).substring(2, 6);
  return `${prefix} [${Date.now()}-${rand}]`;
}

describe('Интеграционный модуль 05: WebSocket API (реалтайм обновления и чат)', () => {
  let queueId = null;

  before(async () => {
    // Создаем отдельную очередь для WS тестирования
    const res = await fetch(`${BASE_URL}/queues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queueName: randomQueueName('WS Realtime Queue'),
        description: 'Тест WebSocket рассылки',
        startTime: '',
        maxParticipants: 10,
        hasPriority: false,
        priorityCount: 0,
        initialPriority: 0,
        skipFeature: true,
        skipDuration: 10,
        imFreeFeature: true,
        swapPositions: true,
        admins: [],
      }),
    });
    const data = await res.json();
    queueId = data.id;
  });

  // Тест 23
  it('Тест 23: Подключение к WebSocket очереди и успешное рукопожатие (handshake)', async () => {
    const wsUrl = `${WS_BASE_URL}/${queueId}?participantId=test-ws-user&senderName=Тестер`;
    const ws = new WebSocket(wsUrl);

    const connected = await new Promise((resolve) => {
      ws.onopen = () => resolve(true);
      ws.onerror = () => resolve(false);
      setTimeout(() => resolve(false), 2000);
    });

    assert.equal(connected, true, 'WebSocket соединение должно успешно установиться');
    ws.close();
  });

  // Тест 24
  it('Тест 24: Отправка и получение сообщения в чате очереди через WebSocket', async () => {
    const wsUrl = `${WS_BASE_URL}/${queueId}?participantId=sender-1&senderName=Алексей`;
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve) => { ws.onopen = resolve; });

    const messagePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout ожидания WS сообщения')), 2500);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'chat_message' && msg.text === 'Привет из интеграционного теста!') {
            clearTimeout(timeout);
            resolve(msg);
          }
        } catch {
          // игнорируем служебные сообщения
        }
      };
    });

    // Отправляем сообщение
    ws.send(JSON.stringify({
      type: 'chat_message',
      text: 'Привет из интеграционного теста!',
    }));

    const received = await messagePromise;
    assert.equal(received.text, 'Привет из интеграционного теста!');
    assert.equal(received.senderName, 'Алексей');

    ws.close();
  });

  // Тест 25
  it('Тест 25: Получение широковещательного обновления queue_update при REST-вступлении участника', async () => {
    const wsUrl = `${WS_BASE_URL}/${queueId}?participantId=listener&senderName=Слушатель`;
    const ws = new WebSocket(wsUrl);

    await new Promise((resolve) => { ws.onopen = resolve; });

    const updatePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout ожидания queue_update')), 2500);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'queue_update') {
            clearTimeout(timeout);
            resolve(msg);
          }
        } catch {
          // игнорируем
        }
      };
    });

    // Вызываем REST API вступления
    await fetch(`${BASE_URL}/queues/${queueId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Новый участник из REST', userId: '' }),
    });

    const updateEvent = await updatePromise;
    assert.equal(updateEvent.type, 'queue_update');
    assert.ok(updateEvent.data, 'Событие queue_update должно содержать актуальные данные очереди');
    assert.equal(updateEvent.data.id, queueId);

    ws.close();
  });
});
