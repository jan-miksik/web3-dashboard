<script setup lang="ts">
import { type NotificationType, useNotifications } from '~/composables/useNotifications'

const { notifications, removeNotification } = useNotifications()

// Unicode/emoji icons for notifications
const getNotificationIcon = (type: NotificationType): string => {
  switch (type) {
    case 'error':
      return '⊗' // Heavy multiplication X - cleaner than ❌
    case 'warning':
      return '⚠' // Warning sign - standard and recognizable
    case 'info':
      return 'i' // Circled information - cleaner than ℹ️
    case 'success':
      return '✔' // Heavy checkmark - bold and clear
    default:
      return 'i'
  }
}

const getNotificationColor = (type: NotificationType): string => {
  switch (type) {
    case 'error':
      return 'var(--error)'
    case 'warning':
      return 'var(--warning)'
    case 'info':
      return 'var(--accent-primary)'
    case 'success':
      return 'var(--success)'
    default:
      return 'var(--text-primary)'
  }
}

const getNotificationBg = (type: NotificationType): string => {
  switch (type) {
    case 'error':
      return 'var(--error-muted)'
    case 'warning':
      return 'var(--warning-muted)'
    case 'info':
      return 'var(--accent-muted)'
    case 'success':
      return 'var(--success-muted)'
    default:
      return 'var(--bg-card)'
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="notification-container">
      <TransitionGroup name="notification" tag="div" class="notification-list">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="notification"
          :class="`notification-${notification.type}`"
          :style="{
            '--notification-color': getNotificationColor(notification.type),
            '--notification-bg': getNotificationBg(notification.type),
          }"
        >
          <div class="notification-content">
            <span class="notification-icon">{{ getNotificationIcon(notification.type) }}</span>
            <span class="notification-message">{{ notification.message }}</span>
          </div>
          <button
            class="notification-close"
            aria-label="Close notification"
            @click="removeNotification(notification.id)"
          >
            ×
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.notification-container {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 1000;
  pointer-events: none;
  max-width: 400px;
  width: 100%;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: auto;
}

.notification {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  background: var(--notification-bg);
  border: 1px solid var(--notification-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(10px);
  animation: slideIn 0.3s ease-out;
  pointer-events: auto;
}

.notification-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.notification-icon {
  font-size: 18px;
  line-height: 1.2;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--notification-color);
  font-weight: 500;
}

.notification-message {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  word-wrap: break-word;
  flex: 1;
}

.notification-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.notification-close:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.1);
}

.notification-close:active {
  transform: scale(0.9);
}

/* Animations */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.notification-enter-active {
  animation: slideIn 0.3s ease-out;
}

.notification-leave-active {
  animation: slideOut 0.3s ease-in;
}

.notification-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

@keyframes slideOut {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* Mobile responsive */
@media (max-width: 768px) {
  .notification-container {
    top: 72px;
    right: 16px;
    left: 16px;
    max-width: none;
  }

  .notification {
    padding: 12px 14px;
  }

  .notification-message {
    font-size: 13px;
  }
}
</style>
