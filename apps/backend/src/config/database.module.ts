import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ConfigModule, ConfigService } from '@nestjs/config'

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('MONGODB_HOST', 'localhost')
        const port = configService.get<number>('MONGODB_PORT', 27017)
        const database = configService.get<string>('MONGODB_DATABASE', 'photo-st-denis')
        const username = configService.get<string>('MONGODB_USERNAME')
        const password = configService.get<string>('MONGODB_PASSWORD')

        let uri = `mongodb://${host}:${port}/${database}`

        if (username && password) {
          uri = `mongodb://${username}:${password}@${host}:${port}/${database}`
        }

        return {
          uri,
          authSource: configService.get<string>('MONGODB_AUTH_SOURCE', 'admin'),
        }
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
