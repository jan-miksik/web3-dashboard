import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ComposerTransactionRecap from '~/components/tx-composer/ComposerWidget/ComposerTransactionRecap.vue'

describe('ComposerTransactionRecap', () => {
  it('renders success overview and 5 items by default', () => {
    const wrapper = mount(ComposerTransactionRecap, {
      props: {
        latestSuccess: {
          hash: '0x1',
          chainId: 1,
          status: 'success',
          timestamp: Date.now(),
          source: 'app',
          outputSummary: '120 OP',
        },
        transactions: Array.from({ length: 7 }, (_, i) => ({
          hash: `0x${i}`,
          chainId: 1,
          status: 'success',
          timestamp: Date.now() - i * 1000,
          source: 'app',
          outputSummary: '1 ETH',
        })),
      },
    })
    expect(wrapper.text()).toContain('Success')
    expect(wrapper.findAll('[data-test="tx-row"]').length).toBe(5)
  })

  it('expands on show more', async () => {
    const wrapper = mount(ComposerTransactionRecap, {
      props: {
        latestSuccess: null,
        transactions: Array.from({ length: 7 }, (_, i) => ({
          hash: `0x${i}`,
          chainId: 1,
          status: 'success',
          timestamp: Date.now() - i * 1000,
          source: 'app',
        })),
      },
    })
    await wrapper.get('[data-test="show-more"]').trigger('click')
    expect(wrapper.findAll('[data-test="tx-row"]').length).toBe(7)
  })
})
