import { Injectable, Logger } from '@nestjs/common'
import { StreamableFile, NotFoundException, InternalServerErrorException } from '@nestjs/common'
import { PassThrough } from 'stream'
import { Order } from '../../order/order.schema'
import { OrderService } from '../../order/order.service'
import { FileProcessingService } from './file-processing.service'

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name)

  constructor(
    private readonly orderService: OrderService,
    private readonly fileProcessingService: FileProcessingService,
  ) {}

  async createDownload(token: string): Promise<StreamableFile> {
    const startTime = Date.now()

    try {
      const order = await this.validateToken(token)

      this.logDownloadStart(order, token)

      const stream = this.createDownloadStream()
      const zipArchiver = this.fileProcessingService.createZipArchiver(stream)

      this.processDirectoriesInBackground(order.directoryPaths, zipArchiver, stream, token)

      this.logSetupComplete(startTime, token)

      const filename = this.generateDownloadFilename(order)

      return this.createStreamableFile(stream, filename)
    } catch (error) {
      return this.handleDownloadError(error, token)
    }
  }

  private async validateToken(token: string): Promise<Order> {
    if (!token?.trim()) {
      throw new NotFoundException('Download token is required')
    }

    const order = await this.orderService.findByToken(token)

    if (!order) {
      this.logger.warn(`Invalid token attempt: ${token}`)
      throw new NotFoundException('Invalid download token')
    }

    if (order.tokenExpiry < new Date()) {
      this.logger.warn(`Expired token attempt: ${token} (expired: ${order.tokenExpiry})`)
      throw new NotFoundException('Download token has expired')
    }

    return order
  }

  private logDownloadStart(order: Order, token: string): void {
    this.logger.log(
      `Starting download for ${order.customerEmail}: ${order.directoryPaths.length} directories, token: ${token}`,
    )
  }

  private createDownloadStream(): PassThrough {
    return new PassThrough({
      highWaterMark: 1024 * 1024, // 1MB buffer for better performance
    })
  }

  private processDirectoriesInBackground(
    directoryPaths: string[],
    zipArchiver: any,
    stream: PassThrough,
    token: string,
  ): void {
    this.fileProcessingService
      .processDirectoriesAsync(directoryPaths, zipArchiver, stream)
      .catch((err) => {
        this.logger.error(`Failed to process directories for token ${token}:`, err.stack)
        if (!stream.destroyed) {
          stream.destroy(err)
        }
      })
  }

  private logSetupComplete(startTime: number, token: string): void {
    const setupTime = Date.now() - startTime
    this.logger.log(`Real-time download setup completed in ${setupTime}ms for token ${token}`)
  }

  private generateDownloadFilename(order: Order): string {
    const dateStr = new Date().toISOString().split('T')[0]
    const dirCount = order.directoryPaths.length
    const emailPrefix = order.customerEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '') // Sanitize

    return `photos-${emailPrefix}-${dateStr}-${dirCount}dirs.zip`
  }

  private createStreamableFile(stream: PassThrough, filename: string): StreamableFile {
    return new StreamableFile(stream, {
      type: 'application/zip',
      disposition: `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    })
  }

  private handleDownloadError(error: any, token: string): never {
    this.logger.error(`Download failed for token ${token}:`, error.stack)

    if (error instanceof NotFoundException) {
      throw error
    }

    throw new InternalServerErrorException('Failed to process download request')
  }
}
