import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Модуль валидации форм создания очереди и вступления участников (FlowQ).
 * Проверяет бизнес-правила и ограничения пользовательского ввода.
 */

const NAME_MAX = 50;
const DESCRIPTION_MAX = 200;

function validateQueueName(name) {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Название очереди обязательно для заполнения' };
  }
  if (trimmed.length > NAME_MAX) {
    return { valid: false, error: `Название не должно превышать ${NAME_MAX} символов` };
  }
  return { valid: true, value: trimmed };
}

function validateDescription(desc) {
  const str = desc ?? '';
  if (str.length > DESCRIPTION_MAX) {
    return { valid: false, error: `Описание не должно превышать ${DESCRIPTION_MAX} символов` };
  }
  return { valid: true, value: str };
}

function validateStartTime(timeStr) {
  const trimmed = (timeStr ?? '').trim();
  if (trimmed === '') {
    return { valid: true, value: '' }; // пустое время разрешено (старт вручную)
  }
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(trimmed)) {
    return { valid: false, error: 'Время начала должно быть в формате ЧЧ:ММ (например, 14:30)' };
  }
  return { valid: true, value: trimmed };
}

function validateMaxParticipants(input) {
  const num = Number.parseInt(String(input ?? '0').trim(), 10);
  if (Number.isNaN(num) || num < 0) {
    return { valid: false, error: 'Лимит участников должен быть неотрицательным числом' };
  }
  return { valid: true, value: num }; // 0 = без ограничений
}

function validateSkipDuration(input) {
  const num = Number.parseInt(String(input ?? '10').trim(), 10);
  if (Number.isNaN(num) || num < 1 || num > 180) {
    return { valid: false, error: 'Длительность пропуска должна быть от 1 до 180 минут' };
  }
  return { valid: true, value: num };
}

function validatePriorityConfig(hasPriority, priorityCount, initialPriority) {
  if (!hasPriority) {
    return { valid: true };
  }
  const count = Number.parseInt(priorityCount, 10);
  const initial = Number.parseInt(initialPriority, 10);

  if (Number.isNaN(count) || count < 1) {
    return { valid: false, error: 'Количество приоритетов должно быть не менее 1' };
  }
  if (Number.isNaN(initial) || initial < 0 || initial > count) {
    return { valid: false, error: 'Начальный приоритет должен быть в диапазоне от 0 до количества приоритетов' };
  }
  return { valid: true, priorityCount: count, initialPriority: initial };
}

function validateParticipantJoinName(name) {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Имя участника не может быть пустым' };
  }
  if (trimmed.length > 50) {
    return { valid: false, error: 'Имя участника не должно превышать 50 символов' };
  }
  return { valid: true, name: trimmed };
}

describe('Модуль 04: validation (проверка входных данных и бизнес-правил форм)', () => {
  // Тест 22
  it('Тест 22: Имя очереди не должно быть пустым или состоять только из пробелов', () => {
    assert.equal(validateQueueName('').valid, false);
    assert.equal(validateQueueName('    ').valid, false);
    assert.equal(validateQueueName(null).valid, false);
    assert.equal(validateQueueName('Электронная очередь').valid, true);
  });

  // Тест 23
  it('Тест 23: Имя очереди должно отклоняться при превышении лимита в 50 символов', () => {
    const valid50 = 'A'.repeat(50);
    const invalid51 = 'A'.repeat(51);

    assert.equal(validateQueueName(valid50).valid, true);
    assert.equal(validateQueueName(invalid51).valid, false);
  });

  // Тест 24
  it('Тест 24: Описание очереди не должно превышать лимит в 200 символов', () => {
    const valid200 = 'D'.repeat(200);
    const invalid201 = 'D'.repeat(201);

    assert.equal(validateDescription(valid200).valid, true);
    assert.equal(validateDescription(invalid201).valid, false);
  });

  // Тест 25
  it('Тест 25: Время начала должно быть в корректном формате ЧЧ:ММ либо оставаться пустым', () => {
    assert.equal(validateStartTime('').valid, true);
    assert.equal(validateStartTime('09:00').valid, true);
    assert.equal(validateStartTime('23:59').valid, true);
    assert.equal(validateStartTime('24:00').valid, false);
    assert.equal(validateStartTime('12:60').valid, false);
    assert.equal(validateStartTime('not-a-time').valid, false);
  });

  // Тест 26
  it('Тест 26: Лимит участников maxParticipants (0 = без ограничений, отрицательные недопустимы)', () => {
    assert.deepEqual(validateMaxParticipants('0'), { valid: true, value: 0 });
    assert.deepEqual(validateMaxParticipants('50'), { valid: true, value: 50 });
    assert.equal(validateMaxParticipants('-5').valid, false);
    assert.equal(validateMaxParticipants('abc').valid, false);
  });

  // Тест 27
  it('Тест 27: Длительность пропуска skipDuration (допустимый диапазон от 1 до 180 минут)', () => {
    assert.deepEqual(validateSkipDuration('10'), { valid: true, value: 10 });
    assert.deepEqual(validateSkipDuration('1'), { valid: true, value: 1 });
    assert.deepEqual(validateSkipDuration('180'), { valid: true, value: 180 });
    assert.equal(validateSkipDuration('0').valid, false);
    assert.equal(validateSkipDuration('-1').valid, false);
    assert.equal(validateSkipDuration('181').valid, false);
  });

  // Тест 28
  it('Тест 28: Начальный приоритет не должен превышать общее количество уровней приоритета', () => {
    assert.equal(validatePriorityConfig(false, 0, 0).valid, true);
    assert.equal(validatePriorityConfig(true, 5, 2).valid, true);
    assert.equal(validatePriorityConfig(true, 5, 5).valid, true);
    assert.equal(validatePriorityConfig(true, 5, 6).valid, false); // initial > count
    assert.equal(validatePriorityConfig(true, 0, 0).valid, false); // count < 1
  });

  // Тест 29
  it('Тест 29: Валидация имени участника при вступлении в очередь', () => {
    assert.equal(validateParticipantJoinName('').valid, false);
    assert.equal(validateParticipantJoinName('   ').valid, false);
    assert.deepEqual(validateParticipantJoinName('  Алексей  '), { valid: true, name: 'Алексей' });
    assert.equal(validateParticipantJoinName('A'.repeat(51)).valid, false);
  });
});
