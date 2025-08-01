import {
  Controller,
  Post,
  Body,
  Get,
  Version,
  Param,
  NotFoundException,
  StreamableFile,
  Header,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'
import { PassThrough } from 'stream'
import { TokenService } from '../token/token.service'
import { OrderService } from '../order/order.service'
import { AssociateDto, AssociateResponseDto } from './dto'
import { Order } from '../order/order.schema'
import { FileProcessingService, SimpleCacheService } from './services'

@ApiTags('transfer')
@Controller('transfer')
export class TransferController {
  private readonly logger = new Logger(TransferController.name)

  constructor(
    private readonly tokenService: TokenService,
    private readonly orderService: OrderService,
    private readonly fileProcessingService: FileProcessingService,
    private readonly simpleCacheService: SimpleCacheService,
  ) {}

  @Version('1')
  @Post('associate')
  @ApiOperation({
    summary: 'Associate photos with customer email',
    description: 'Creates a new order and generates a download token for the specified directories',
  })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: AssociateResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  async associate(@Body() associateDto: AssociateDto): Promise<AssociateResponseDto> {
    // Validate input
    if (!associateDto.directoryPaths?.length) {
      throw new BadRequestException('At least one directory path is required')
    }

    const token = this.tokenService.generateToken()
    const tokenExpiry = new Date(Date.now() + 72 * 3600000) // 72 hours

    try {
      await this.orderService.createOrder({
        customerEmail: associateDto.email,
        directoryPaths: associateDto.directoryPaths,
        downloadToken: token,
        tokenExpiry,
      })

      this.logger.log(
        `Created order for ${associateDto.email} with ${associateDto.directoryPaths.length} directories`,
      )

      return { token }
    } catch (error) {
      this.logger.error('Failed to create order:', error.stack)
      throw new InternalServerErrorException('Failed to create download order')
    }
  }

  @Version('1')
  @Get('download/:token')
  @ApiOperation({
    summary: 'Download photos as ZIP',
    description: 'Downloads all photos from the associated directories as a ZIP file',
  })
  @ApiParam({
    name: 'token',
    description: 'The download token received from the associate endpoint',
    required: true,
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'ZIP file containing photos',
    content: {
      'application/zip': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found or token expired',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during file processing',
  })
  @Header('Content-Type', 'application/zip')
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @Header('Content-Disposition', 'attachment')
  async download(@Param('token') token: string): Promise<StreamableFile> {
    const startTime = Date.now()

    try {
      const order = await this.validateToken(token)

      this.logger.log(
        `Starting download for ${order.customerEmail}: ${order.directoryPaths.length} directories, token: ${token}`,
      )

      // Check if we have a pre-generated ZIP file
      const cachedZipPath = await this.simpleCacheService.getCachedZip(order.directoryPaths)

      if (cachedZipPath) {
        this.logger.log(`Serving cached ZIP for token: ${token}`)

        // Generate descriptive filename
        const dateStr = new Date().toISOString().split('T')[0]
        const dirCount = order.directoryPaths.length
        const filename = `photos-${order.customerEmail.split('@')[0]}-${dateStr}-${dirCount}dirs.zip`

        const setupTime = Date.now() - startTime
        this.logger.log(`Cached download setup completed in ${setupTime}ms for token ${token}`)

        // Stream the cached file
        const fs = await import('fs')
        const readStream = fs.createReadStream(cachedZipPath)

        return new StreamableFile(readStream, {
          type: 'application/zip',
          disposition: `attachment; filename="${filename}"`,
        })
      }

      this.logger.log(`No cache found, generating ZIP in real-time for token: ${token}`)

      const stream = new PassThrough({
        highWaterMark: 1024 * 1024, // 1MB buffer for better performance
      })

      const zipArchiver = this.fileProcessingService.createZipArchiver(stream)

      // Process directories in the background with proper error handling
      this.fileProcessingService
        .processDirectoriesAsync(order.directoryPaths, zipArchiver, stream)
        .catch((err) => {
          this.logger.error(`Failed to process directories for token ${token}:`, err.stack)
          if (!stream.destroyed) {
            stream.destroy(err)
          }
        })

      const setupTime = Date.now() - startTime
      this.logger.log(`Real-time download setup completed in ${setupTime}ms for token ${token}`)

      // Generate a more descriptive filename
      const dateStr = new Date().toISOString().split('T')[0]
      const dirCount = order.directoryPaths.length
      const filename = `photos-${order.customerEmail.split('@')[0]}-${dateStr}-${dirCount}dirs.zip`

      return new StreamableFile(stream, {
        type: 'application/zip',
        disposition: `attachment; filename="${filename}"`,
      })
    } catch (error) {
      this.logger.error(`Download failed for token ${token}:`, error.stack)

      if (error instanceof NotFoundException) {
        throw error
      }

      throw new InternalServerErrorException('Failed to process download request')
    }
  }

  /**
   * Validates a download token and returns the associated order.
   *
   * @param token - The download token to validate
   * @returns The order associated with the token
   * @throws NotFoundException if token is invalid or expired
   */
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

  /**
   * Get cache statistics
   */
  @Get('cache/stats')
  @Version('1')
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({ status: 200, description: 'Cache statistics' })
  async getCacheStats() {
    const stats = await this.simpleCacheService.getCacheStats()
    return {
      ...stats,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Manually flush all cache
   */
  @Post('cache/flush')
  @Version('1')
  @ApiOperation({ summary: 'Manually flush all cache files' })
  @ApiResponse({ status: 200, description: 'Cache flushed successfully' })
  async flushCache() {
    const result = await this.simpleCacheService.flushAllCache()
    return {
      message: 'Cache flushed successfully',
      ...result,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Flush old cache files (older than specified hours)
   */
  @Post('cache/flush/:hours')
  @Version('1')
  @ApiOperation({ summary: 'Flush cache files older than specified hours' })
  @ApiParam({ name: 'hours', description: 'Age in hours', type: 'number' })
  @ApiResponse({ status: 200, description: 'Old cache files flushed' })
  async flushOldCache(@Param('hours') hours: string) {
    const hoursNum = parseInt(hours, 10)
    if (isNaN(hoursNum) || hoursNum < 0) {
      throw new BadRequestException('Hours must be a positive number')
    }

    const result = await this.simpleCacheService.flushCacheOlderThan(hoursNum * 60 * 60 * 1000)
    return {
      message: `Cache files older than ${hoursNum} hours flushed`,
      ...result,
      timestamp: new Date().toISOString(),
    }
  }
}
