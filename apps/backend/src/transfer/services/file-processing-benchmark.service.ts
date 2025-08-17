import { Injectable, Logger } from '@nestjs/common'
import * as path from 'path'
import * as archiver from 'archiver'
import { PhotosConfigService } from './photos-config.service'

/**
 * Performance comparison: File-by-file vs Directory-level archiving
 */
@Injectable()
export class FileProcessingBenchmarkService {
  private readonly logger = new Logger(FileProcessingBenchmarkService.name)

  constructor(private readonly photosConfig: PhotosConfigService) {}

  /**
   * Method 1: Current approach - file by file with pre-filtering
   */
  async addFilesToArchiveOneByOne(
    imageFiles: string[],
    fullPath: string,
    zipArchiver: archiver.Archiver,
    relativeDirPath: string,
  ): Promise<number> {
    const startTime = Date.now()

    const filePromises = imageFiles.map((file) =>
      this.addSingleFileToArchive(file, fullPath, zipArchiver, relativeDirPath),
    )

    const results = await Promise.all(filePromises)
    const duration = Date.now() - startTime

    this.logger.debug(`File-by-file approach: ${duration}ms for ${imageFiles.length} files`)
    return results.filter(Boolean).length
  }

  /**
   * Method 2: Directory-level with filter function
   * Uses archiver's built-in directory method with filtering
   */
  async addDirectoryWithFilter(
    fullPath: string,
    zipArchiver: archiver.Archiver,
    relativeDirPath: string,
  ): Promise<void> {
    const startTime = Date.now()
    const lastDirName = path.basename(relativeDirPath)

    // Use archiver's directory method with filter function
    zipArchiver.directory(fullPath, lastDirName, (entryData) => {
      // Return false to ignore non-image files
      if (!this.photosConfig.isValidImageFile(entryData.name)) {
        return false
      }
      // Return the entry data to include the file
      return entryData
    })

    const duration = Date.now() - startTime
    this.logger.debug(`Directory approach: ${duration}ms for directory ${relativeDirPath}`)
  }

  private async addSingleFileToArchive(
    fileName: string,
    basePath: string,
    zipArchiver: archiver.Archiver,
    relativeDirPath: string,
  ): Promise<boolean> {
    const filePath = path.join(basePath, fileName)
    const lastDirName = path.basename(relativeDirPath)
    const zipEntryPath = path.join(lastDirName, fileName)

    try {
      zipArchiver.file(filePath, { name: zipEntryPath })
      return true
    } catch (err) {
      this.logger.warn(`Failed to add file to ZIP: ${filePath}`, (err as Error).message)
      return false
    }
  }
}
