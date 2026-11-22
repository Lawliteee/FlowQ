import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Модульные тесты алгоритмов и бизнес-логики управления очередью (FlowQ).
 * Тестируются чистые функции и инварианты состояния, используемые во фронтенде и логике сервиса.
 */

// 1. Алгоритм фильтрации числового ввода (CreateQueueView)
function filterDigits(input) {
  return String(input ?? '').replace(/\D/g, '');
}

// 2. Алгоритм расчёта ожидаемого времени (ETA) для каждого участника
function calculateETAs(participantsCount, avgWaitMinutes = 5) {
  if (participantsCount <= 0) return [];
  const etas = new Array(participantsCount);
  for (let i = 0; i < participantsCount; i++) {
    etas[i] = Math.round(avgWaitMinutes * (i + 1));
  }
  return etas;
}

// 3. Определение статуса участника в очереди (QueueView)
function resolveParticipantStatus({ myId, currentParticipant, participants, etas, queueStarted }) {
  if (!queueStarted) {
    return { status: 'NOT_STARTED', waitTime: 0, peopleAhead: 0 };
  }

  // Если текущий вызванный участник — это мы
  if (currentParticipant && currentParticipant.id === myId) {
    return { status: 'CALLED', waitTime: -1, peopleAhead: 0 };
  }

  // Поиск нашей позиции среди ожидающих
  const index = participants.findIndex((p) => p.id === myId);
  if (index === -1) {
    return { status: 'KICKED_OR_LEFT', waitTime: null, peopleAhead: 0 };
  }

  return {
    status: 'WAITING',
    waitTime: etas[index] ?? null,
    peopleAhead: index,
  };
}

// 4. Ограничение длины сообщения чата и скользящее окно истории (макс 20)
function pushChatMessage(history, message, maxHistory = 20, maxTextLen = 100) {
  const truncatedText = (message.text || '').slice(0, maxTextLen);
  const updated = [
    ...history,
    {
      senderId: message.senderId,
      senderName: message.senderName,
      text: truncatedText,
    },
  ];
  if (updated.length > maxHistory) {
    return updated.slice(updated.length - maxHistory);
  }
  return updated;
}

// 5. Определение списка участников для админ-панели (AdminView)
function getDisplayedParticipants(currentParticipant, participants) {
  if (!currentParticipant) {
    return participants;
  }
  return participants.filter((p) => p.id !== currentParticipant.id);
}

describe('Модуль 03: queue_logic (бизнес-логика и расчетные алгоритмы очереди)', () => {
  describe('Фильтрация числового ввода (filterDigits)', () => {
    // Тест 10
    it('Тест 10: должен удалять нечисловые символы и пробелы', () => {
      assert.equal(filterDigits('42abc'), '42');
      assert.equal(filterDigits('  1 0 5  '), '105');
      assert.equal(filterDigits('no-digits'), '');
      assert.equal(filterDigits('007'), '007');
    });

    // Тест 11
    it('Тест 11: должен корректно обрабатывать null и undefined', () => {
      assert.equal(filterDigits(null), '');
      assert.equal(filterDigits(undefined), '');
    });
  });

  describe('Расчет ETA (calculateETAs)', () => {
    // Тест 12
    it('Тест 12: должен возвращать пустой массив для пустой очереди', () => {
      assert.deepEqual(calculateETAs(0), []);
    });

    // Тест 13
    it('Тест 13: должен корректно вычислять прогнозируемое время ожидания по формуле avgWait * (i + 1)', () => {
      const avgWait = 4;
      const etas = calculateETAs(3, avgWait);
      // Участник 0 (первый): 4 мин
      // Участник 1 (второй): 8 мин
      // Участник 2 (третий): 12 мин
      assert.deepEqual(etas, [4, 8, 12]);
    });
  });

  describe('Определение статуса участника (resolveParticipantStatus)', () => {
    const p1 = { id: 'u1', name: 'Иван' };
    const p2 = { id: 'u2', name: 'Ольга' };
    const p3 = { id: 'u3', name: 'Сергей' };
    const participants = [p1, p2, p3];
    const etas = [5, 10, 15];

    // Тест 14
    it('Тест 14: должен возвращать статус NOT_STARTED, если очередь еще не начата', () => {
      const res = resolveParticipantStatus({
        myId: 'u2',
        currentParticipant: null,
        participants,
        etas,
        queueStarted: false,
      });
      assert.equal(res.status, 'NOT_STARTED');
      assert.equal(res.waitTime, 0);
    });

    // Тест 15
    it('Тест 15: должен возвращать статус CALLED и waitTime = -1, когда подошла наша очередь', () => {
      const res = resolveParticipantStatus({
        myId: 'u1',
        currentParticipant: p1,
        participants: [p2, p3],
        etas: [5, 10],
        queueStarted: true,
      });
      assert.equal(res.status, 'CALLED');
      assert.equal(res.waitTime, -1);
      assert.equal(res.peopleAhead, 0);
    });

    // Тест 16
    it('Тест 16: должен корректно рассчитывать peopleAhead и ETA для ожидающего участника', () => {
      const res = resolveParticipantStatus({
        myId: 'u3',
        currentParticipant: null,
        participants,
        etas,
        queueStarted: true,
      });
      assert.equal(res.status, 'WAITING');
      assert.equal(res.peopleAhead, 2); // перед Сергеем стоят Иван и Ольга
      assert.equal(res.waitTime, 15);
    });

    // Тест 17
    it('Тест 17: должен возвращать KICKED_OR_LEFT, если участник не найден среди ожидающих и не вызван', () => {
      const res = resolveParticipantStatus({
        myId: 'unknown_user',
        currentParticipant: p1,
        participants: [p2, p3],
        etas: [5, 10],
        queueStarted: true,
      });
      assert.equal(res.status, 'KICKED_OR_LEFT');
    });
  });

  describe('Ограничения и буферизация чата (pushChatMessage)', () => {
    // Тест 18
    it('Тест 18: должен обрезать текст длиннее 100 символов', () => {
      const longText = 'A'.repeat(150);
      const res = pushChatMessage([], { senderId: 'u1', senderName: 'Тест', text: longText });
      assert.equal(res[0].text.length, 100);
      assert.equal(res[0].text, 'A'.repeat(100));
    });

    // Тест 19
    it('Тест 19: должен удерживать не более 20 сообщений в истории', () => {
      let history = [];
      for (let i = 1; i <= 25; i++) {
        history = pushChatMessage(history, { senderId: 'u1', text: `Сообщение #${i}` });
      }
      assert.equal(history.length, 20);
      assert.equal(history[0].text, 'Сообщение #6');
      assert.equal(history[19].text, 'Сообщение #25');
    });
  });

  describe('Список участников админ-панели (getDisplayedParticipants)', () => {
    // Тест 20
    it('Тест 20: должен исключать текущего вызванного участника из списка ожидания', () => {
      const current = { id: 'u1', name: 'Иван' };
      const list = [
        { id: 'u1', name: 'Иван' },
        { id: 'u2', name: 'Ольга' },
      ];
      const displayed = getDisplayedParticipants(current, list);
      assert.equal(displayed.length, 1);
      assert.equal(displayed[0].id, 'u2');
    });

    // Тест 21
    it('Тест 21: должен возвращать полный список, если текущий участник отсутствует', () => {
      const list = [{ id: 'u1' }, { id: 'u2' }];
      const displayed = getDisplayedParticipants(null, list);
      assert.equal(displayed.length, 2);
    });
  });
});
