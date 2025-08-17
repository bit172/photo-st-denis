import { Injectable } from '@nestjs/common'
import { randomBytes } from 'crypto'

@Injectable()
export class TokenService {
  /**
   * Generates a cryptographically secure random token
   * @returns hex string token
   */
  generateToken(size: number = 8): string {
    return randomBytes(size).toString('hex')
  }
}
