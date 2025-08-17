import { Module } from '@nestjs/common'
import { TransferController } from './transfer.controller'
import { TokenModule } from '../token/token.module'
import { OrderModule } from '../order/order.module'
import { PhotosConfigService, FileProcessingService, DownloadService } from './services'

@Module({
  imports: [TokenModule, OrderModule],
  controllers: [TransferController],
  providers: [PhotosConfigService, FileProcessingService, DownloadService],
})
export class TransferModule {}
