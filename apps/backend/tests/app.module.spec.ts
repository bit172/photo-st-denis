import { AppModule } from '../src/app.module'

describe('AppModule', () => {
  it('should be defined', () => {
    expect(AppModule).toBeDefined()
  })

  it('should be a valid NestJS module', () => {
    expect(typeof AppModule).toBe('function')
    expect(AppModule.name).toBe('AppModule')
  })
})
