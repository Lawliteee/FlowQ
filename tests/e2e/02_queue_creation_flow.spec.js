import { test, expect } from '@playwright/test';

function randomEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).substring(2, 7)}@flowq-e2e.test`;
}

test.describe('E2E Модуль 02: Авторизация и полный флоу создания очереди', () => {
  const organizerEmail = randomEmail();
  const organizerPassword = 'SecurePassword123!';
  const organizerName = 'Иван Организатор';

  // Тест 5
  test('Тест 5: Регистрация нового организатора через UI и появление аватара в шапке', async ({ page }) => {
    await page.goto('/');

    // Открываем окно входа и переключаемся на регистрацию
    await page.locator('.header-nav a', { hasText: 'Войти' }).click();
    await page.locator('.modal a', { hasText: 'Зарегистрироваться' }).click();

    // Заполняем поля формы регистрации
    const inputs = page.locator('.modal input.modal-input');
    await inputs.nth(0).fill(organizerName); // Имя
    await inputs.nth(1).fill(organizerEmail); // Email
    await inputs.nth(2).fill(organizerPassword); // Пароль

    await page.locator('.modal button.modal-btn', { hasText: 'Зарегистрироваться' }).click();

    // Модалка закрылась, в шапке появился аватар профиля
    await expect(page.locator('.modal')).not.toBeVisible();
    await expect(page.locator('.avatar-btn')).toBeVisible();

    // Кнопка "Создать очередь" стала активной
    const createBtn = page.locator('button.btn-primary2');
    await expect(createBtn).toBeEnabled();
  });

  // Тест 6
  test('Тест 6: Переход на страницу создания очереди (/create-queue) и валидация счетчика описания', async ({ page }) => {
    // Авторизуемся предварительно через cookie
    await page.goto('/');
    await page.locator('.header-nav a', { hasText: 'Войти' }).click();
    const inputs = page.locator('.modal input.modal-input');
    await inputs.nth(0).fill(organizerEmail);
    await inputs.nth(1).fill(organizerPassword);
    await page.locator('.modal button.modal-btn', { hasText: 'Войти' }).click();
    await expect(page.locator('.avatar-btn')).toBeVisible();

    // Кликаем "Создать очередь"
    await page.locator('button.btn-primary2').click();
    await expect(page).toHaveURL(/\/create-queue/);

    // Проверяем счетчик символов описания
    const descTextarea = page.locator('#description');
    await descTextarea.fill('Тестовое описание для E2E сценария');

    const counter = page.locator('.char-counter');
    await expect(counter).toContainText('34/');
  });

  // Тест 7
  test('Тест 7: Заполнение параметров очереди и отправка формы создания', async ({ page }) => {
    await page.goto('/');
    await page.locator('.header-nav a', { hasText: 'Войти' }).click();
    const loginInputs = page.locator('.modal input.modal-input');
    await loginInputs.nth(0).fill(organizerEmail);
    await loginInputs.nth(1).fill(organizerPassword);
    await page.locator('.modal button.modal-btn', { hasText: 'Войти' }).click();

    await page.goto('/create-queue');

    // Заполняем форму
    await page.locator('#queueName').fill('E2E Автотестовая Очередь');
    await page.locator('#description').fill('Очередь создана автоматически тестом Playwright');

    // Включаем функции обмена и пропуска
    const swapCheckbox = page.locator('input[type="checkbox"]').nth(0);
    if (!(await swapCheckbox.isChecked())) {
      await swapCheckbox.check();
    }

    // Нажимаем "Создать"
    await page.locator('button.btn-create').click();

    // Должна появиться модалка QueueCreatedModal
    await expect(page.locator('.modal h3')).toHaveText('Очередь создана!');
  });

  // Тест 8
  test('Тест 8: Отображение модального окна QueueCreatedModal и переход в админ-панель', async ({ page }) => {
    await page.goto('/');
    await page.locator('.header-nav a', { hasText: 'Войти' }).click();
    const loginInputs = page.locator('.modal input.modal-input');
    await loginInputs.nth(0).fill(organizerEmail);
    await loginInputs.nth(1).fill(organizerPassword);
    await page.locator('.modal button.modal-btn', { hasText: 'Войти' }).click();

    await page.goto('/create-queue');
    await page.locator('#queueName').fill('Очередь для проверки админки');
    await page.locator('button.btn-create').click();

    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    // Проверяем поле с ID очереди
    const idInput = modal.locator('input.id-input');
    const queueId = await idInput.inputValue();
    expect(queueId).toBeTruthy();

    // Кликаем "Перейти к очереди"
    await modal.locator('button.modal-btn', { hasText: 'Перейти к очереди' }).click();

    // Проверяем переход в панель администратора /admin/:id
    await expect(page).toHaveURL(new RegExp(`/admin/${queueId}`));
    await expect(page.locator('.queue-name')).toContainText('Очередь для проверки админки');
    await expect(page.locator('button.btn-next')).toContainText('Начать очередь');
  });
});
