import { Injectable, Logger } from '@nestjs/common'
import { PassThrough } from 'stream'
import * as fs from 'fs'
import * as path from 'path'
import * as archiver from 'archiver'
import { PhotosConfigService } from './photos-config.service'
import type { Archiver } from 'archiver'

/**
 * Metrics interface for tracking ZIP processing performance
 */
interface ProcessingMetrics {
  /** Start timestamp in milliseconds */
  startTime: number
  /** Time spent processing directories in milliseconds */
  directoryProcessingTime: number
  /** Time spent finalizing the archive in milliseconds */
  finalizationTime: number
  /** Total number of files processed */
  totalFiles: number
  /** Total size of all files in MB */
  totalSizeMB: number
}

/**
 * Service responsible for processing photo directories and creating ZIP archives.
 * Optimized for photo files with no compression for maximum performance.
 */
@Injectable()
export class FileProcessingService {
  private readonly logger = new Logger(FileProcessingService.name)

  /** Archive configuration optimized for local storage and photo files */
  private readonly ARCHIVER_CONFIG = {
    zlib: { level: 0 }, // No compression for photos
    store: true,
    forceLocalTime: true,
    statConcurrency: 16, // Increased for local storage
    highWaterMark: 1024 * 1024, // 1MB buffer for better I/O
  } as const

  constructor(private readonly photosConfig: PhotosConfigService) {}

  /**
   * Creates and configures a ZIP archiver instance optimized for local storage.
   * Sets up event handlers for tracking progress and errors.
   *
   * @param stream - PassThrough stream to pipe the ZIP data to
   * @returns Configured archiver instance
   */
  createZipArchiver(stream: PassThrough): Archiver {
    const zipArchiver = archiver('zip', this.ARCHIVER_CONFIG)

    this.setupArchiverEventHandlers(zipArchiver, stream)
    zipArchiver.pipe(stream)

    return zipArchiver
  }

  /**
   * Main method to process multiple directories and create a ZIP archive.
   * Tracks detailed timing metrics and handles errors gracefully.
   *
   * @param directoryPaths - Array of directory paths to process
   * @param zipArchiver - Configured archiver instance
   * @param stream - PassThrough stream for error handling
   * @throws Error if processing fails critically
   */
  async processDirectoriesAsync(
    directoryPaths: string[],
    zipArchiver: archiver.Archiver,
    stream: PassThrough,
  ): Promise<void> {
    const metrics: ProcessingMetrics = {
      startTime: Date.now(),
      directoryProcessingTime: 0,
      finalizationTime: 0,
      totalFiles: 0,
      totalSizeMB: 0,
    }

    try {
      this.logger.log(`Starting to process ${directoryPaths.length} directories`)

      await this.processDirectories(directoryPaths, zipArchiver, metrics)
      await this.finalizeArchive(zipArchiver, metrics)

      this.logProcessingResults(metrics)
    } catch (err) {
      this.logger.error('Error processing directories:', err.stack)
      stream.destroy(err as Error)
      throw err
    }
  }

  /**
   * Sets up event handlers for the archiver to track progress and handle errors.
   * Monitors file count, total bytes, and completion status.
   *
   * @param zipArchiver - The archiver instance to configure
   * @param stream - PassThrough stream for error propagation
   */
  private setupArchiverEventHandlers(zipArchiver: Archiver, stream: PassThrough): void {
    let totalBytes = 0
    let fileCount = 0

    zipArchiver.on('error', (err: Error) => {
      this.logger.error('Archiver error:', err.stack)
      stream.destroy(err)
    })

    zipArchiver.on('entry', (entry) => {
      if (entry.stats) {
        totalBytes += entry.stats.size
        fileCount++
      }
    })

    zipArchiver.on('end', () => {
      this.logger.log(
        `Archive completed: ${fileCount} files, ${(totalBytes / 1024 / 1024).toFixed(2)}MB total`,
      )
    })
  }

  /**
   * Processes all directories in parallel and updates timing metrics.
   *
   * @param directoryPaths - Array of directory paths to process
   * @param zipArchiver - Configured archiver instance
   * @param metrics - Metrics object to update with timing data
   */
  private async processDirectories(
    directoryPaths: string[],
    zipArchiver: archiver.Archiver,
    metrics: ProcessingMetrics,
  ): Promise<void> {
    const dirProcessStartTime = Date.now()

    const processPromises = directoryPaths.map((dirPath) =>
      this.processDirectory(dirPath, zipArchiver),
    )

    await Promise.all(processPromises)

    metrics.directoryProcessingTime = Date.now() - dirProcessStartTime
    this.logger.log(`Directory processing completed in ${metrics.directoryProcessingTime}ms`)
  }

  /**
   * Finalizes the archive and tracks finalization timing.
   *
   * @param zipArchiver - The archiver instance to finalize
   * @param metrics - Metrics object to update with timing data
   */
  private async finalizeArchive(
    zipArchiver: archiver.Archiver,
    metrics: ProcessingMetrics,
  ): Promise<void> {
    const finalizeStartTime = Date.now()

    await zipArchiver.finalize()

    metrics.finalizationTime = Date.now() - finalizeStartTime
    this.logger.log(`Archive finalization took ${metrics.finalizationTime}ms`)
  }

  /**
   * Logs the final processing results with total duration.
   *
   * @param metrics - Processing metrics to log
   */
  private logProcessingResults(metrics: ProcessingMetrics): void {
    const totalDuration = Date.now() - metrics.startTime
    const seconds = (totalDuration / 1000).toFixed(2)

    this.logger.log(`Successfully finalized ZIP archive in ${totalDuration}ms (${seconds}s)`)
  }

  /**
   * Processes a single directory: validates existence, finds image files, and adds them to archive.
   * Continues processing other directories even if one fails.
   *
   * @param dirPath - Relative directory path from the photos base
   * @param zipArchiver - Configured archiver instance
   */
  private async processDirectory(dirPath: string, zipArchiver: archiver.Archiver): Promise<void> {
    try {
      const fullPath = this.photosConfig.getFullPhotoPath(dirPath)

      if (!(await this.photosConfig.checkDirectoryExists(fullPath))) {
        this.logger.warn(`Directory not found: ${fullPath}`)
        return
      }

      const imageFiles = await this.getImageFiles(fullPath)
      const addedCount = await this.addFilesToArchive(imageFiles, fullPath, zipArchiver, dirPath)

      this.logger.log(`Added ${addedCount} files from directory: ${dirPath}`)
    } catch (err) {
      this.logger.error(`Error processing directory ${dirPath}:`, err.stack)
      // Continue with other directories
    }
  }

  /**
   * Reads a directory and filters for valid image files.
   *
   * @param fullPath - Full filesystem path to the directory
   * @returns Array of image filenames
   */
  private async getImageFiles(fullPath: string): Promise<string[]> {
    const files = await fs.promises.readdir(fullPath)
    return files.filter((file) => this.photosConfig.isValidImageFile(file))
  }

  /**
   * Adds all image files from a directory to the ZIP archive in parallel.
   *
   * @param imageFiles - Array of image filenames
   * @param fullPath - Full filesystem path to the directory
   * @param zipArchiver - Configured archiver instance
   * @param relativeDirPath - Relative directory path for ZIP structure
   * @returns Number of files successfully added
   */
  private async addFilesToArchive(
    imageFiles: string[],
    fullPath: string,
    zipArchiver: archiver.Archiver,
    relativeDirPath: string,
  ): Promise<number> {
    const filePromises = imageFiles.map((file) =>
      this.addSingleFileToArchive(file, fullPath, zipArchiver, relativeDirPath),
    )

    const results = await Promise.all(filePromises)
    return results.filter(Boolean).length
  }

  /**
   * Adds a single file to the ZIP archive with flattened directory structure.
   * Only uses the immediate parent directory name in the ZIP path.
   *
   * @param fileName - Name of the file to add
   * @param basePath - Full filesystem path to the directory containing the file
   * @param zipArchiver - Configured archiver instance
   * @param relativeDirPath - Relative directory path (only basename will be used)
   * @returns True if file was added successfully, false otherwise
   */
  private async addSingleFileToArchive(
    fileName: string,
    basePath: string,
    zipArchiver: archiver.Archiver,
    relativeDirPath: string,
  ): Promise<boolean> {
    const filePath = path.join(basePath, fileName)

    // Use only the last directory name instead of the full relative path
    // This flattens the ZIP structure: "00July2025/08070018" becomes "08070018"
    const lastDirName = path.basename(relativeDirPath)
    const zipEntryPath = path.join(lastDirName, fileName)

    try {
      zipArchiver.file(filePath, { name: zipEntryPath })
      return true
    } catch (err) {
      this.logger.warn(`Failed to add file to ZIP: ${filePath}`, err.message)
      return false
    }
  }
}
