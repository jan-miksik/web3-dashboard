/**
 * Notification system composable
 *
 * Provides a centralized way to show notifications/toasts to users
 * Supports different notification types: error, warning, info, success
 */

export type NotificationType = 'error' | 'warning' | 'info' | 'success'

export interface Notification {
  id: string
  message: string
  type: NotificationType
  duration?: number // Duration in milliseconds, undefined means no auto-dismiss
  timestamp: number
}

// Global notification state (can be accessed from anywhere)
const notifications = ref<Notification[]>([])

/**
 * Internal function to remove a notification by ID
 * Can be called from anywhere (not just composable context)
 */
function removeNotification(id: string): void {
  if (!import.meta.client) {
    return
  }

  const index = notifications.value.findIndex(n => n.id === id)
  if (index !== -1) {
    notifications.value.splice(index, 1)
  }
}

/**
 * Standalone function to show a notification
 * Can be called from anywhere (not just composable context)
 *
 * @param message - The message to display
 * @param type - The type of notification (error, warning, info, success)
 * @param duration - Duration in milliseconds before auto-dismissing. Default: 5000ms. Set to 0 or undefined for no auto-dismiss
 */
export function showNotification(
  message: string,
  type: NotificationType = 'info',
  duration: number = 5000
): string {
  if (!import.meta.client) {
    return ''
  }

  const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  const notification: Notification = {
    id,
    message,
    type,
    duration: duration > 0 ? duration : undefined,
    timestamp: Date.now(),
  }

  notifications.value.push(notification)

  // Auto-dismiss if duration is set
  if (duration > 0) {
    setTimeout(() => {
      removeNotification(id)
    }, duration)
  }

  return id
}

export function showErrorNotification(message: string, duration?: number): string {
  return showNotification(message, 'error', duration)
}

export function showWarningNotification(message: string, duration?: number): string {
  return showNotification(message, 'warning', duration)
}

export function showInfoNotification(message: string, duration?: number): string {
  return showNotification(message, 'info', duration)
}

export function showSuccessNotification(message: string, duration?: number): string {
  return showNotification(message, 'success', duration)
}

export function clearAllNotifications(): void {
  if (!import.meta.client) {
    return
  }
  notifications.value = []
}

/**
 * Composable for use in Vue components
 * Provides the same functions as standalone exports, but in a composable form
 *
 * @example
 * ```typescript
 * const { showNotification, showError } = useNotifications()
 *
 * showNotification('Wallet connected successfully', 'success')
 * showError('Transaction failed', 10000)
 * ```
 */
export function useNotifications() {
  return {
    notifications: readonly(notifications),
    showNotification,
    showError: showErrorNotification,
    showWarning: showWarningNotification,
    showInfo: showInfoNotification,
    showSuccess: showSuccessNotification,
    removeNotification,
    clearAll: clearAllNotifications,
  }
}
