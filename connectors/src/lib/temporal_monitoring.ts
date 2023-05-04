import { Context } from "@temporalio/activity";
import {
  ActivityExecuteInput,
  ActivityInboundCallsInterceptor,
  Next,
} from "@temporalio/worker";
import StatsDClient from "hot-shots";

import logger, { Logger } from "@connectors/logger/logger";

/** An Activity Context with an attached logger */
export interface ContextWithLogger extends Context {
  logger: typeof logger;
}

const statsDClient = new StatsDClient({});

export class ActivityInboundLogInterceptor
  implements ActivityInboundCallsInterceptor
{
  public readonly logger: Logger;
  private readonly context: Context;

  constructor(ctx: Context, logger: Logger) {
    this.context = ctx;
    this.logger = logger.child({
      activityName: ctx.info.activityType,
      workflowName: ctx.info.workflowType,
      workflowId: ctx.info.workflowExecution.workflowId,
      workflowRunId: ctx.info.workflowExecution.runId,
      activityId: ctx.info.activityId,
    });

    // Set a logger instance on the current Activity Context to provide
    // contextual logging information to each log entry generated by the Activity.
    (ctx as ContextWithLogger).logger = this.logger;
  }

  async execute(
    input: ActivityExecuteInput,
    next: Next<ActivityInboundCallsInterceptor, "execute">
  ): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let error: any = undefined;
    const startTime = new Date();
    const tags = [
      `activity_name:${this.context.info.activityType}`,
      `workflow_name:${this.context.info.workflowType}`,
      `activity_id:${this.context.info.activityId}`,
      `workflow_id:${this.context.info.workflowExecution.workflowId}`,
      `workflow_run_id:${this.context.info.workflowExecution.runId}`,
    ];

    try {
      return await next(input);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      error = err;
      throw err;
    } finally {
      const durationMs = new Date().getTime() - startTime.getTime();
      if (error) {
        let errorType = "unhandled_internal_activity_error";
        if (error.__is_dust_error !== undefined) {
          // this is a dust error
          errorType = error.type;
          this.logger.error({ error, durationMs }, "Activity failed");
        } else {
          // unknown error type
          this.logger.error(
            {
              error,
              error_stack: error?.stack,
              durationMs: durationMs,
            },
            "Activity failed"
          );
        }

        tags.push(`error_type:${errorType}`);
        statsDClient.increment("activity_failed.count", 1, tags);
      } else {
        this.logger.info({ durationMs: durationMs }, "Activity completed.");
        statsDClient.increment("activities_success.count", 1, tags);
        statsDClient.histogram("activities.duration", durationMs, tags);
      }
    }
  }
}
