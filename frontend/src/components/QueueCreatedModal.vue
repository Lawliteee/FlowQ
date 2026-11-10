<template>
  <div class="modal" @click.self="$emit('close')">
    <div class="modal-content">
      <h3>Очередь создана!</h3>
      <p class="label">Идентификатор для участников:</p>
      <div class="id-row">
        <input class="id-input" :value="queueId" readonly />
        <button class="btn-copy" @click="copy">{{ copied ? 'Скопировано' : 'Копировать' }}</button>
      </div>
      <p v-if="autoCopied" class="auto-hint">ID уже скопирован в буфер обмена</p>
      <button class="modal-btn" @click="$emit('close')">Перейти к очереди</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const props = defineProps({ queueId: String, autoCopied: Boolean })
defineEmits(['close'])

const copied = ref(false)

// Копирует id очереди
async function copy() {
  try {
    await navigator.clipboard.writeText(props.queueId)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // буфер обмена недоступен - ID можно выделить в поле вручную
  }
}
</script>

<style scoped>

.modal {
  position: fixed;
  top: 0;left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  text-align: center;
  box-sizing: border-box;
}

h3 {
  font-size: 21px;
  font-weight: 400;
  margin-bottom: 20px;
  color: var(--text);
}

.label {
  font-size: 14px;
  text-align: left;
  color: var(--text-muted);
  margin-bottom: 10px;
  padding-left: 4px;
}

.id-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.auto-hint {
  font-size: 13px;
  color: var(--text-muted);
  text-align: left;
  padding-left: 4px;
  margin-bottom: 20px;
}

.id-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--primary);
  border-radius: 10px;
  font-family: 'Fira Sans', sans-serif;
  font-size: 14px;
  color: var(--text);
  background: white;
  outline: none;
}

.btn-copy {
  padding: 10px 16px;
  border: 1px solid var(--primary);
  border-radius: 10px;
  background: white;
  font-family: 'Fira Sans', sans-serif;
  font-size: 14px;
  cursor: pointer;
  color: var(--text);
  white-space: nowrap;
  transition: background 0.20s;
}

.btn-copy:hover { background: var(--panel-hover); }

.modal-btn {
  background: var(--primary-dark);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 14px 1px;
  font-size: 16px;
  font-weight: 700;
  width: 70%;
  font-family: 'Fira Sans', sans-serif;
  cursor: pointer;
  transition: background 0.20s;
}

.modal-btn:hover { background: var(--primary); }
</style>
