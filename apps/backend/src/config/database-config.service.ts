import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class DatabaseConfigService {
  constructor(private configService: ConfigService) {}

  getMongoUri(): string {
    const username = this.configService.get<string>('MONGODB_USERNAME')
    const password = this.configService.get<string>('MONGODB_PASSWORD')
    const host = this.configService.get<string>('MONGODB_HOST', 'localhost')
    const port = this.configService.get<string>('MONGODB_PORT', '27017')
    const database = this.configService.get<string>('MONGODB_DATABASE', 'photo-st-denis')

    // If username and password are provided, use authenticated connection
    if (username && password) {
      return `mongodb://${username}:${password}@${host}:${port}/${database}?authSource=admin`
    }

    // If no credentials, try without authentication (local development)
    return `mongodb://${host}:${port}/${database}`
  }

  getMongoOptions() {
    return {
      // Connection options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
    }
  }
}
