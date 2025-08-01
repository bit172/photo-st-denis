import { Injectable } from '@nestjs/common'
import { randomBytes } from 'crypto'

@Injectable()
export class TokenService {
  generateToken(): string {
    return randomBytes(32).toString('hex')
  }
}
