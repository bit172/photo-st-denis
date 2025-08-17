import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import * as request from 'supertest'
import { TransferController } from '../src/transfer/transfer.controller'
import { TokenService } from '../src/token/token.service'
import { OrderService } from '../src/order/order.service'
import { DownloadService } from '../src/transfer/services/download.service'

describe('TransferController (Integration)', () => {
  let app: INestApplication

  // Mock services for integration testing
  const mockOrderService = {
    createOrder: jest.fn(),
    findByToken: jest.fn(),
  }

  const mockDownloadService = {
    createDownload: jest.fn(),
  }

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TransferController],
      providers: [
        TokenService,
        {
          provide: OrderService,
          useValue: mockOrderService,
        },
        {
          provide: DownloadService,
          useValue: mockDownloadService,
        },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(new ValidationPipe())

    await app.init()
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  describe('POST /transfer/associate', () => {
    it('should create a new order and return download info', async () => {
      const associateDto = {
        email: 'test@example.com',
        directoryPaths: ['/path/to/photos1', '/path/to/photos2'],
      }

      mockOrderService.createOrder.mockResolvedValue(undefined)

      const response = await request(app.getHttpServer())
        .post('/transfer/associate')
        .send(associateDto)
        .expect(201)

      expect(response.body).toHaveProperty('token')
      expect(response.body).toHaveProperty('downloadUrl')
      expect(response.body).toHaveProperty('expiresAt')
      expect(response.body.downloadUrl).toMatch(/\/api\/v1\/transfer\/download\//)

      expect(mockOrderService.createOrder).toHaveBeenCalledWith({
        customerEmail: associateDto.email,
        directoryPaths: associateDto.directoryPaths,
        downloadToken: expect.any(String),
        tokenExpiry: expect.any(Date),
      })
    })

    it('should return 400 if no directory paths provided', async () => {
      const associateDto = {
        email: 'test@example.com',
        directoryPaths: [],
      }

      await request(app.getHttpServer())
        .post('/transfer/associate')
        .send(associateDto)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('At least one directory path is required')
        })

      expect(mockOrderService.createOrder).not.toHaveBeenCalled()
    })

    it('should return 400 if email is missing', async () => {
      const associateDto = {
        directoryPaths: ['/path/to/photos'],
      }

      await request(app.getHttpServer()).post('/transfer/associate').send(associateDto).expect(400)
    })

    it('should return 500 if order creation fails', async () => {
      const associateDto = {
        email: 'test@example.com',
        directoryPaths: ['/path/to/photos'],
      }

      mockOrderService.createOrder.mockRejectedValue(new Error('Database error'))

      await request(app.getHttpServer())
        .post('/transfer/associate')
        .send(associateDto)
        .expect(500)
        .expect((res) => {
          expect(res.body.message).toBe('Failed to create download order')
        })
    })
  })

  describe('GET /transfer/download/:token', () => {
    it('should call download service with token', async () => {
      const token = 'test-token-123'
      const mockStreamableFile = { getStream: jest.fn() }

      mockDownloadService.createDownload.mockResolvedValue(mockStreamableFile)

      await request(app.getHttpServer()).get(`/transfer/download/${token}`).expect(200)

      expect(mockDownloadService.createDownload).toHaveBeenCalledWith(token)
    })

    it('should handle download service errors', async () => {
      const token = 'invalid-token'

      mockDownloadService.createDownload.mockRejectedValue(new Error('Token not found'))

      await request(app.getHttpServer()).get(`/transfer/download/${token}`).expect(500)
    })
  })
})
