import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { CacheModule } from '@nestjs/cache-manager'
import { TransferModule } from './transfer/transfer.module'
import { TokenModule } from './token/token.module'
import { OrderModule } from './order/order.module'
import { DatabaseModule } from './config/database.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    CacheModule.register({
      isGlobal: true,
      ttl: 24 * 60 * 60 * 1000, // 24 hours default TTL (in milliseconds)
    }),
    DatabaseModule,
    TransferModule,
    TokenModule,
    OrderModule,
  ],
})
export class AppModule {}
