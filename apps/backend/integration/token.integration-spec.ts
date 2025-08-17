import { Test, TestingModule } from '@nestjs/testing'
import { TokenService } from '../src/token/token.service'

describe('TokenService (Integration)', () => {
  let service: TokenService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenService],
    }).compile()

    service = module.get<TokenService>(TokenService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  it('should generate unique tokens in rapid succession', () => {
    const tokens = new Set()
    const count = 100

    // Generate tokens rapidly to test uniqueness
    for (let i = 0; i < count; i++) {
      tokens.add(service.generateToken())
    }

    expect(tokens.size).toBe(count)
  })

  it('should generate tokens with consistent format', () => {
    const tokens = Array.from({ length: 10 }, () => service.generateToken())

    tokens.forEach((token) => {
      expect(token).toMatch(/^[a-f0-9]{16}$/i)
      expect(token).toHaveLength(16)
    })
  })
})
