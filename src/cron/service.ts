/**
 * Cron service - manages scheduled tasks
 */
import cron from 'node-cron';
import { MessageBus } from '../bus/queue';
import { logger } from '../config/logger';

export interface CronJob {
  id: string;
  schedule: string;
  payload: string;
  channel: string;
  chat_id: string;
  enabled: boolean;
  created_at: string;
  last_run?: string;
}

export class CronService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobConfigs: Map<string, CronJob> = new Map();
  private readonly bus: MessageBus;
  private readonly workspace: string;

  constructor(bus: MessageBus, workspace: string) {
    this.bus = bus;
    this.workspace = workspace;
    logger.info('Cron service initialized');
  }

  /**
   * Add a new cron job
   */
  add_job(job: CronJob): boolean {
    if (this.jobs.has(job.id)) {
      logger.warn(`Cron job ${job.id} already exists, overwriting`);
      this.remove_job(job.id);
    }

    try {
      const task = cron.schedule(job.schedule, () => {
        logger.info(`Running cron job ${job.id}: ${job.payload.slice(0, 50)}`);
        // Publish as system message
        this.bus.publish_inbound({
          channel: 'system',
          sender_id: 'cron',
          chat_id: `${job.channel}:${job.chat_id}`,
          content: job.payload,
          metadata: {
            cron_job_id: job.id,
            scheduled: true,
          },
        });
        // Update last run time
        job.last_run = new Date().toISOString();
        this.jobConfigs.set(job.id, job);
      });

      this.jobs.set(job.id, task);
      this.jobConfigs.set(job.id, job);
      
      if (job.enabled) {
        task.start();
      } else {
        task.stop();
      }

      logger.info(`Added cron job ${job.id} with schedule "${job.schedule}"`);
      return true;
    } catch (error) {
      logger.error(`Failed to add cron job ${job.id}:`, error);
      return false;
    }
  }

  /**
   * Remove a cron job
   */
  remove_job(job_id: string): boolean {
    const task = this.jobs.get(job_id);
    if (task) {
      task.stop();
      this.jobs.delete(job_id);
      this.jobConfigs.delete(job_id);
      logger.info(`Removed cron job ${job_id}`);
      return true;
    }
    logger.warn(`Cron job ${job_id} not found`);
    return false;
  }

  /**
   * Start a cron job
   */
  start_job(job_id: string): boolean {
    const task = this.jobs.get(job_id);
    const config = this.jobConfigs.get(job_id);
    if (task && config) {
      task.start();
      config.enabled = true;
      logger.info(`Started cron job ${job_id}`);
      return true;
    }
    logger.warn(`Cron job ${job_id} not found`);
    return false;
  }

  /**
   * Stop a cron job
   */
  stop_job(job_id: string): boolean {
    const task = this.jobs.get(job_id);
    const config = this.jobConfigs.get(job_id);
    if (task && config) {
      task.stop();
      config.enabled = false;
      logger.info(`Stopped cron job ${job_id}`);
      return true;
    }
    logger.warn(`Cron job ${job_id} not found`);
    return false;
  }

  /**
   * List all cron jobs
   */
  list_jobs(): CronJob[] {
    return Array.from(this.jobConfigs.values());
  }

  /**
   * Get a cron job by id
   */
  get_job(job_id: string): CronJob | undefined {
    return this.jobConfigs.get(job_id);
  }

  /**
   * Validate cron expression
   */
  validate_schedule(schedule: string): boolean {
    return cron.validate(schedule);
  }

  /**
   * Start all enabled cron jobs
   */
  start_all(): void {
    for (const [id, task] of this.jobs.entries()) {
      const config = this.jobConfigs.get(id);
      if (config?.enabled) {
        task.start();
        logger.debug(`Started cron job ${id}`);
      }
    }
    logger.info('All enabled cron jobs started');
  }

  /**
   * Stop all cron jobs
   */
  stop_all(): void {
    for (const [id, task] of this.jobs.entries()) {
      task.stop();
      logger.debug(`Stopped cron job ${id}`);
    }
    logger.info('All cron jobs stopped');
  }

  /**
   * Destroy the cron service and stop all jobs
   */
  destroy(): void {
    this.stop_all();
    this.jobs.clear();
    this.jobConfigs.clear();
    logger.info('Cron service destroyed');
  }

  /**
   * Generate next run times for a cron expression
   */
  get_next_runs(schedule: string, count: number = 5): Date[] {
    try {
      // @ts-ignore - cron has getNextDates method but types are missing
      return cron.getNextDates(schedule, count);
    } catch (error) {
      logger.error(`Failed to get next runs for schedule "${schedule}":`, error);
      return [];
    }
  }
}

// Singleton instance
let cronService: CronService | null = null;

export function getCronService(bus?: MessageBus, workspace?: string): CronService {
  if (!cronService) {
    if (!bus || !workspace) {
      throw new Error('MessageBus and workspace required for first cron service initialization');
    }
    cronService = new CronService(bus, workspace);
  }
  return cronService;
}
