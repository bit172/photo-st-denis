import { IsEmail, IsArray, IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AssociateRequest } from '@photo-st-denis/shared'

export class AssociateDto implements AssociateRequest {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The email address of the customer',
  })
  @IsEmail()
  email: string

  @ApiProperty({
    example: ['photos/event1', 'photos/event2'],
    description: 'List of directory paths containing the photos',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  directoryPaths: string[]
}
