import { Test, TestingModule } from '@nestjs/testing'
import { TokenService } from '../../src/token/token.service'

describe('TokenService', () => {
  let service: TokenService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenService],
    }).compile()

    service = module.get<TokenService>(TokenService)
  })

  describe('generateToken', () => {
    it('should generate a token with default size (8 bytes = 16 hex chars)', () => {
      const token = service.generateToken()

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token).toHaveLength(16) // 8 bytes * 2 hex chars per byte
      expect(token).toMatch(/^[a-f0-9]{16}$/i) // hex characters only
    })

    it('should generate a token with custom size', () => {
      const token = service.generateToken(12)

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token).toHaveLength(24) // 12 bytes * 2 hex chars per byte
      expect(token).toMatch(/^[a-f0-9]{24}$/i) // hex characters only
    })

    it('should generate unique tokens', () => {
      const token1 = service.generateToken()
      const token2 = service.generateToken()

      expect(token1).not.toBe(token2)
    })

    it('should generate tokens with different sizes', () => {
      const small = service.generateToken(4)
      const medium = service.generateToken(8)
      const large = service.generateToken(16)

      expect(small).toHaveLength(8) // 4 bytes * 2
      expect(medium).toHaveLength(16) // 8 bytes * 2
      expect(large).toHaveLength(32) // 16 bytes * 2
    })

    it('should handle edge cases', () => {
      const tiny = service.generateToken(1)
      const zero = service.generateToken(0)

      expect(tiny).toHaveLength(2) // 1 byte * 2
      expect(zero).toHaveLength(0) // 0 bytes
    })

    it('should generate cryptographically random tokens', () => {
      // Generate multiple tokens and ensure they're all different
      const tokens = new Set()
      const count = 1000

      for (let i = 0; i < count; i++) {
        tokens.add(service.generateToken())
      }

      // All tokens should be unique (very high probability with crypto random)
      expect(tokens.size).toBe(count)
    })
  })
})
