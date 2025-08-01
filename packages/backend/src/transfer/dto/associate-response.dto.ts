import { ApiProperty } from '@nestjs/swagger'

export class AssociateResponseDto {
  @ApiProperty({
    description: 'Download token for accessing the photos',
    example: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  })
  token: string
}
