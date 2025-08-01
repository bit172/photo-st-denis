import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Enable validation pipe
  app.useGlobalPipes(new ValidationPipe())

  // Enable API versioning
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: 'api/v',
  })

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Photo St-Denis API')
    .setDescription('API for managing photo transfers and downloads')
    .setVersion('1.0')
    .addTag('transfer', 'Photo transfer operations')
    .build()

  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  await app.listen(process.env.PORT ?? 3000)
}
bootstrap().catch((error) => {
  console.error('Failed to start application:', error)
  process.exit(1)
})
