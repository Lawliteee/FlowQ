import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Модуль тестирования граничных случаев управления очередью (FlowQ).
 * Рассматривает пограничные переполнения, вызовы на пустой очереди,
 * выбывание из середины и спец-возврат при ушедшей очереди.
 */

// Эмуляция проверки возможности вступления в очередь
function canJoinQueue(currentParticipantsCount, maxParticipants) {
  if (maxParticipants <= 0) {
    return { allowed: true }; // 0 = без ограничений
  }
  if (currentParticipantsCount >= maxParticipants) {
    return { allowed: false, reason: 'Queue is full', statusCode: 409 };
  }
  return { allowed: true };
}

// Эмуляция сдвига очереди (CallNext / ShiftParticipant)
function shiftQueue(state) {
  if (state.participants.length === 0) {
    return { error: 'No participants', statusCode: 400 };
  }
  const [called, ...rest] = state.participants;
  return {
    error: null,
    currentParticipant: called,
    currentNumber: state.currentNumber + 1,
    participants: rest,
  };
}

// Эмуляция выхода участника из очереди (LeaveQueue)
function leaveQueue(participants, participantId) {
  const index = participants.findIndex((p) => p.id === participantId);
  if (index === -1) {
    return { changed: false, participants };
  }
  const updated = [...participants.slice(0, index), ...participants.slice(index + 1)];
  return { changed: true, removedIndex: index, participants: updated };
}

// Эмуляция алгоритма возврата участника (ReturnParticipant в store.go)
function returnParticipant(participants, returningParticipant, originalPosition) {
  const totalCount = participants.length;

  // Ключевой инвариант FlowQ: если старое место уже ушло (origPos > totalCount),
  // участник становится первым в текущей очереди!
  if (originalPosition > totalCount || originalPosition <= 1) {
    return [returningParticipant, ...participants];
  }

  // Иначе возвращаем на его прежнюю позицию
  const insertIndex = originalPosition - 1;
  return [
    ...participants.slice(0, insertIndex),
    returningParticipant,
    ...participants.slice(insertIndex),
  ];
}

// Эмуляция действия "Я освободился" (ImFree)
function handleImFree(state) {
  if (state.participants.length > 0) {
    return shiftQueue(state);
  }
  // Очередь пуста — сбрасываем текущего участника
  return {
    error: null,
    currentParticipant: null,
    currentNumber: state.currentNumber,
    participants: [],
  };
}

describe('Модуль 07: edge_cases_queue (граничные случаи жизненного цикла очереди)', () => {
  // Тест 41
  it('Тест 41: Пограничное переполнение очереди: вход разрешен при N = max - 1, отклоняется при N = max', () => {
    const max = 10;
    assert.equal(canJoinQueue(9, max).allowed, true);
    assert.equal(canJoinQueue(10, max).allowed, false);
    assert.equal(canJoinQueue(11, max).allowed, false);
  });

  // Тест 42
  it('Тест 42: Безлимитная очередь (maxParticipants = 0) принимает участников без ограничений', () => {
    assert.equal(canJoinQueue(0, 0).allowed, true);
    assert.equal(canJoinQueue(1000, 0).allowed, true);
  });

  // Тест 43
  it('Тест 43: Вызов следующего (CallNext) при пустой очереди должен безопасно возвращать ошибку', () => {
    const emptyState = { participants: [], currentNumber: 0, currentParticipant: null };
    const res = shiftQueue(emptyState);
    assert.equal(res.error, 'No participants');
    assert.equal(res.statusCode, 400);
  });

  // Тест 44
  it('Тест 44: Вызов следующего при очереди ровно из одного участника: он становится current, а очередь — пустой', () => {
    const singleState = {
      participants: [{ id: 'single-1', name: 'Одиночный' }],
      currentNumber: 0,
      currentParticipant: null,
    };
    const res = shiftQueue(singleState);
    assert.equal(res.error, null);
    assert.equal(res.currentParticipant.id, 'single-1');
    assert.equal(res.currentNumber, 1);
    assert.equal(res.participants.length, 0);
  });

  // Тест 45
  it('Тест 45: Покидание очереди из середины: позиции последующих участников сдвигаются на -1, предыдущих — не меняются', () => {
    const p1 = { id: 'p1', name: 'Первый' };
    const p2 = { id: 'p2', name: 'Второй' };
    const p3 = { id: 'p3', name: 'Третий' };
    const list = [p1, p2, p3];

    // Удаляем p2 (второго)
    const { changed, participants: updated } = leaveQueue(list, 'p2');
    assert.equal(changed, true);
    assert.equal(updated.length, 2);
    assert.equal(updated[0].id, 'p1'); // остался на 1-м месте
    assert.equal(updated[1].id, 'p3'); // переместился с 3-го на 2-е место
  });

  // Тест 46
  it('Тест 46: Покидание очереди несуществующим ID не изменяет состояние и порядок очереди', () => {
    const list = [{ id: 'p1' }, { id: 'p2' }];
    const { changed, participants: updated } = leaveQueue(list, 'ghost_id');
    assert.equal(changed, false);
    assert.deepEqual(updated, list);
  });

  // Тест 47
  it('Тест 47: Возврат участника (Return), когда очередь ушла вперед (origPos > totalCount): участник становится первым', () => {
    // Участник был 5-м. Пока он был в пропуске, очередь сократилась до 2 человек.
    const currentQueue = [{ id: 'pA', name: 'А' }, { id: 'pB', name: 'Б' }];
    const returning = { id: 'pReturn', name: 'Вернувшийся' };

    const result = returnParticipant(currentQueue, returning, 5);
    // Должен встать в самое начало
    assert.equal(result[0].id, 'pReturn');
    assert.equal(result.length, 3);
  });

  // Тест 48
  it('Тест 48: Действие "Я освободился" (ImFree) при пустом остатке очереди корректно очищает текущего участника', () => {
    const state = {
      participants: [],
      currentNumber: 5,
      currentParticipant: { id: 'last-user', name: 'Последний' },
    };
    const res = handleImFree(state);
    assert.equal(res.error, null);
    assert.equal(res.currentParticipant, null);
    assert.equal(res.currentNumber, 5);
  });
});
