describe('Home Page E2E Tests', () => {
  beforeEach(() => {
    // Visit the home page before each test
    cy.visit('/')
  })

  it('should display the home page', () => {
    cy.contains('Web3 Dashboard').should('be.visible')
  })

  it('should show connect wallet button when not connected', () => {
    cy.get('[data-testid="connect-button"]').should('be.visible')
    cy.get('[data-testid="connect-button-text"]').should('contain', 'Connect Wallet')
  })

  it('should have proper page structure', () => {
    // Check that main elements exist
    cy.get('body').should('exist')
    cy.get('main, [role="main"], .main, #app').should('exist')
  })

  it('should be responsive', () => {
    // Test mobile viewport
    cy.viewport(375, 667)
    cy.get('[data-testid="connect-button"]').should('be.visible')

    // Test tablet viewport
    cy.viewport(768, 1024)
    cy.get('[data-testid="connect-button"]').should('be.visible')

    // Test desktop viewport
    cy.viewport(1920, 1080)
    cy.get('[data-testid="connect-button"]').should('be.visible')
  })
})
