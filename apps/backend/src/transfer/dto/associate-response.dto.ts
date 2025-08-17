import { ApiProperty } from '@nestjs/swagger'
import { DownloadResponse } from '@photo-st-denis/shared'

export class AssociateResponseDto implements DownloadResponse {
  @ApiProperty({
    description: 'Download token for accessing the photos',
    example: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  token: string

  @ApiProperty({
    description: 'Full URL for downloading the photos',
    example:
      '/api/v1/transfer/download/1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  downloadUrl: string

  @ApiProperty({
    description: 'Token expiration timestamp',
    example: '2025-08-12T16:44:26.000Z',
    type: Date,
  })
  expiresAt: Date
}
