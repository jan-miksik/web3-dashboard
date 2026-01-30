import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  showNotification,
  showErrorNotification,
  showSuccessNotification,
  clearAllNotifications,
  useNotifications,
} from '../../../app/composables/useNotifications'

/**
 * useNotifications.test.ts
 *
 * SECURES: Centralized notification system used by error-handler and tx feedback.
 * WHY: Users must see errors and success feedback. Broken notifications mean silent failures
 * and confused users. Tests ensure add/remove/clear and type routing work.
 */
describe('useNotifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearAllNotifications()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('showNotification adds notification with correct type and message', () => {
    const id = showNotification('Test message', 'info', 5000)
    expect(id).toMatch(/^notification-\d+-[a-z0-9]+$/)

    const { notifications } = useNotifications()
    expect(notifications.value).toHaveLength(1)
    expect(notifications.value[0]).toMatchObject({
      message: 'Test message',
      type: 'info',
      duration: 5000,
    })
  })

  it('showErrorNotification uses error type', () => {
    showErrorNotification('Error message')
    const { notifications } = useNotifications()
    expect(notifications.value[0].type).toBe('error')
    expect(notifications.value[0].message).toBe('Error message')
  })

  it('showSuccessNotification uses success type', () => {
    showSuccessNotification('Done!')
    const { notifications } = useNotifications()
    expect(notifications.value[0].type).toBe('success')
  })

  it('clearAllNotifications removes all notifications', () => {
    showNotification('A', 'info', 5000)
    showNotification('B', 'info', 5000)
    expect(useNotifications().notifications.value).toHaveLength(2)
    clearAllNotifications()
    expect(useNotifications().notifications.value).toHaveLength(0)
  })

  it('notification with duration > 0 auto-removes after timeout', () => {
    showNotification('Auto-dismiss', 'info', 3000)
    expect(useNotifications().notifications.value).toHaveLength(1)
    vi.advanceTimersByTime(3000)
    expect(useNotifications().notifications.value).toHaveLength(0)
  })

  it('useNotifications returns removeNotification and it removes by id', () => {
    const comp = useNotifications()
    showNotification('To remove', 'info', 0) // duration 0 = no auto-dismiss
    expect(comp.notifications.value).toHaveLength(1)
    const id = comp.notifications.value[0]!.id
    comp.removeNotification(id)
    expect(comp.notifications.value).toHaveLength(0)
  })

  it('useNotifications returns showWarning and showInfo', () => {
    const comp = useNotifications()
    comp.showWarning('Warn')
    comp.showInfo('Info')
    expect(comp.notifications.value[0]!.type).toBe('warning')
    expect(comp.notifications.value[1]!.type).toBe('info')
  })
})
