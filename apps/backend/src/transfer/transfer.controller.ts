import {
  Controller,
  Post,
  Body,
  Get,
  Version,
  Param,
  StreamableFile,
  Header,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger'
import { TokenService } from '../token/token.service'
import { OrderService } from '../order/order.service'
import { AssociateDto, AssociateResponseDto } from './dto'
import { DownloadService } from './services'

@ApiTags('transfer')
@Controller('transfer')
export class TransferController {
  private readonly logger = new Logger(TransferController.name)

  constructor(
    private readonly tokenService: TokenService,
    private readonly orderService: OrderService,
    private readonly downloadService: DownloadService,
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

      return {
        token,
        downloadUrl: `/api/v1/transfer/download/${token}`,
        expiresAt: tokenExpiry,
      }
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
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  async download(@Param('token') token: string): Promise<StreamableFile> {
    return this.downloadService.createDownload(token)
  }
}
