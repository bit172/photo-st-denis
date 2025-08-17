import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as path from 'path'
import * as fs from 'fs'

@Injectable()
export class PhotosConfigService implements OnModuleInit {
  private readonly logger = new Logger(PhotosConfigService.name)
  private readonly supportedImageExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.tiff',
    '.tif',
    '.webp',
    '.bmp',
  ]

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.validateConfiguration()
  }

  getPhotosBasePath(): string {
    return this.configService.get<string>('PHOTOS_BASE_PATH', '/mnt/psd')
  }

  getFullPhotoPath(relativePath: string): string {
    // Sanitize the relative path to prevent directory traversal
    const sanitizedPath = this.sanitizePath(relativePath)
    return path.join(this.getPhotosBasePath(), sanitizedPath)
  }

  getSupportedImageExtensions(): string[] {
    return [...this.supportedImageExtensions]
  }

  isValidImageFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase()
    return this.supportedImageExtensions.includes(ext)
  }

  private sanitizePath(relativePath: string): string {
    // Remove any path traversal attempts (../, ..\, etc.)
    const sanitized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '')

    // Ensure it doesn't start with / or \ to keep it relative
    return sanitized.replace(/^[/\\]+/, '')
  }

  private async validateConfiguration(): Promise<void> {
    try {
      const basePath = this.getPhotosBasePath()

      // Check if base path exists and is accessible
      await fs.promises.access(basePath, fs.constants.R_OK)

      // Check if it's actually a directory
      const stats = await fs.promises.stat(basePath)
      if (!stats.isDirectory()) {
        throw new Error(`Photos base path is not a directory: ${basePath}`)
      }

      this.logger.log(`Photos base path validated: ${basePath}`)

      // Optional: Check if it's a mount point (for NAS validation)
      await this.validateMountPoint(basePath)
    } catch (error) {
      this.logger.error(`Failed to validate photos configuration: ${error.message}`)
      throw error
    }
  }

  private async validateMountPoint(basePath: string): Promise<void> {
    try {
      // Check if it's actually mounted by comparing with parent directory device
      const parentPath = path.dirname(basePath)
      const [baseStats, parentStats] = await Promise.all([
        fs.promises.stat(basePath),
        fs.promises.stat(parentPath),
      ])

      // Different device numbers usually indicate a mount point
      if (baseStats.dev !== parentStats.dev) {
        this.logger.log(`Mount point detected at: ${basePath}`)
      } else {
        this.logger.warn(`Path may not be a mount point: ${basePath}`)
      }
    } catch (error) {
      this.logger.warn(`Could not validate mount point: ${error.message}`)
    }
  }

  async checkDirectoryExists(fullPath: string): Promise<boolean> {
    try {
      await fs.promises.access(fullPath, fs.constants.R_OK)
      const stats = await fs.promises.stat(fullPath)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  async getDirectorySize(dirPath: string): Promise<number> {
    try {
      const fullPath = this.getFullPhotoPath(dirPath)
      let totalSize = 0

      const files = await fs.promises.readdir(fullPath)
      const imageFiles = files.filter((file) => this.isValidImageFile(file))

      for (const file of imageFiles) {
        const filePath = path.join(fullPath, file)
        const stats = await fs.promises.stat(filePath)
        if (stats.isFile()) {
          totalSize += stats.size
        }
      }

      return totalSize
    } catch (error) {
      this.logger.warn(`Failed to calculate directory size for ${dirPath}: ${error.message}`)
      return 0
    }
  }

  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }
}
