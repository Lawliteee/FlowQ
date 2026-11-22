import { test, expect } from '@playwright/test';

test.describe('E2E Модуль 01: Навигация, роли и модальные окна', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // Тест 1
  test('Тест 1: Отображение главной страницы, заголовок и карточки ролей (Участник / Организатор)', async ({ page }) => {
    // Проверка логотипа
    await expect(page.locator('.logo')).toBeVisible();

    // Проверка главного заголовка
    await expect(page.locator('h1')).toContainText('Управляйте очередями без хаоса');

    // Проверка карточек выбора ролей
    const roleCards = page.locator('.role-card');
    await expect(roleCards).toHaveCount(2);
    await expect(roleCards.nth(0)).toContainText('Участник');
    await expect(roleCards.nth(1)).toContainText('Организатор');
  });

  // Тест 2
  test('Тест 2: Клик по кнопке "Вступить в очередь" открывает модальное окно JoinModal', async ({ page }) => {
    const joinBtn = page.locator('button.btn-primary1', { hasText: 'Вступить в очередь' });
    await joinBtn.click();

    // Модальное окно должно появиться
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toHaveText('Вступить в очередь');

    // Наличие полей ввода
    await expect(modal.locator('input[placeholder="Ваше имя"]')).toBeVisible();
    await expect(modal.locator('input[placeholder="Идентификатор очереди"]')).toBeVisible();

    // Кнопка вступления заблокирована, пока поля пусты
    const submitBtn = modal.locator('button.modal-btn');
    await expect(submitBtn).toBeDisabled();
  });

  // Тест 3
  test('Тест 3: Кнопка "Создать очередь" заблокирована для неавторизованного пользователя', async ({ page }) => {
    const createBtn = page.locator('button.btn-primary2');
    await expect(createBtn).toBeDisabled();

    // Подсказка об обязательной авторизации
    await expect(page.locator('.auth-hint')).toHaveText('Необходимо авторизоваться');
  });

  // Тест 4
  test('Тест 4: Открытие модального окна входа и переключение на регистрацию (LoginModal <-> RegisterModal)', async ({ page }) => {
    // Клик по ссылке "Войти" в шапке
    const loginLink = page.locator('.header-nav a', { hasText: 'Войти' });
    await loginLink.click();

    // Появилась модалка входа
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('h3')).toHaveText('Вход в аккаунт');

    // Переключение на регистрацию
    const switchLink = modal.locator('a', { hasText: 'Зарегистрироваться' });
    await switchLink.click();

    // Заголовок изменился на "Регистрация аккаунта"
    await expect(modal.locator('h3')).toHaveText('Регистрация аккаунта');

    // Закрытие модального окна по крестику
    await modal.locator('button.modal-close').click();
    await expect(modal).not.toBeVisible();
  });
});
