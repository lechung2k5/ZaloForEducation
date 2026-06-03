import {
  GetCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from "@nestjs/common";
import { DynamoDBService } from "../../infrastructure/dynamodb.service";
import { ChatGateway } from "./chat.gateway";
import { NotificationService } from "./notification.service";

type AssignmentReminderWindow = "24h" | "1h";
const DEFAULT_MAX_FILE_SIZE_MB = 10;
const BYTES_PER_MB = 1024 * 1024;

@Injectable()
export class AssignmentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssignmentService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private isChecking = false;

  constructor(
    private readonly db: DynamoDBService,
    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  onModuleInit() {
    this.intervalRef = setInterval(() => {
      this.checkUpcomingDeadlines().catch((error) => {
        this.logger.error("Assignment deadline check failed", error);
      });
    }, 60 * 1000);

    setTimeout(() => {
      this.checkUpcomingDeadlines().catch((error) => {
        this.logger.error("Initial assignment deadline check failed", error);
      });
    }, 10 * 1000);
  }

  onModuleDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
  }

  async submitAssignment(
    convId: string,
    messageId: string,
    userEmail: string,
    body: { note?: string; attachments?: any[] },
  ) {
    const existing = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: convId, SK: messageId },
      }),
    );

    if (!existing.Item) {
      throw new BadRequestException("Assignment message not found");
    }

    const message = existing.Item as any;
    const assignment = message.payload?.assignment;
    if (!assignment) {
      throw new BadRequestException("Message is not an assignment");
    }

    const normalizedEmail = userEmail.toLowerCase();
    const assignees = Array.isArray(assignment.assignees)
      ? assignment.assignees.map((item: string) => String(item).toLowerCase())
      : [];

    if (assignees.length > 0 && !assignees.includes(normalizedEmail)) {
      throw new BadRequestException("User is not assigned to this assignment");
    }

    this.ensureBeforeDeadline(assignment);

    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];
    this.validateSubmissionAttachments(assignment, attachments);

    const now = new Date().toISOString();
    const nextPayload = {
      ...(message.payload || {}),
      assignment: {
        ...assignment,
        submissions: {
          ...(assignment.submissions || {}),
          [normalizedEmail]: {
            submittedAt: now,
            note: String(body?.note || "").trim(),
            attachments,
            status: "submitted",
          },
        },
      },
    };

    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: convId, SK: messageId },
        UpdateExpression: "SET payload = :payload, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":payload": nextPayload,
          ":updatedAt": now,
        },
      }),
    );

    const creatorEmail = String(message.senderId || "").toLowerCase();
    if (creatorEmail && creatorEmail !== normalizedEmail) {
      await this.notificationService.broadcastNotification([creatorEmail], {
        title: "Có bài nộp mới",
        body: `${normalizedEmail} đã nộp bài "${assignment.title || "Bài tập"}".`,
        data: {
          convId,
          messageId,
          type: "assignment_submission",
          submitter: normalizedEmail,
        },
      });
    }

    return {
      ...message,
      payload: nextPayload,
      updatedAt: now,
      id: message.id || message.SK,
    };
  }

  async deleteSubmission(
    convId: string,
    messageId: string,
    userEmail: string,
  ) {
    const existing = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: convId, SK: messageId },
      }),
    );

    if (!existing.Item) {
      throw new BadRequestException("Assignment message not found");
    }

    const message = existing.Item as any;
    const assignment = message.payload?.assignment;
    if (!assignment) {
      throw new BadRequestException("Message is not an assignment");
    }

    this.ensureBeforeDeadline(assignment);

    const normalizedEmail = userEmail.toLowerCase();
    const submissions = { ...(assignment.submissions || {}) };
    if (!submissions[normalizedEmail]) {
      throw new BadRequestException("Submission not found");
    }

    delete submissions[normalizedEmail];

    const now = new Date().toISOString();
    const nextPayload = {
      ...(message.payload || {}),
      assignment: {
        ...assignment,
        submissions,
      },
    };

    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: convId, SK: messageId },
        UpdateExpression: "SET payload = :payload, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":payload": nextPayload,
          ":updatedAt": now,
        },
      }),
    );

    return {
      ...message,
      payload: nextPayload,
      updatedAt: now,
      id: message.id || message.SK,
    };
  }

  private ensureBeforeDeadline(assignment: any) {
    const deadlineTime = new Date(assignment?.deadline).getTime();
    if (Number.isFinite(deadlineTime) && deadlineTime < Date.now()) {
      throw new BadRequestException("Assignment deadline has passed");
    }
  }

  private validateSubmissionAttachments(assignment: any, attachments: any[]) {
    const maxFiles = Number(assignment.maxFiles || 3);
    const maxFileSizeMB = Number(
      assignment.maxFileSizeMB || DEFAULT_MAX_FILE_SIZE_MB,
    );
    const maxFileSizeBytes = maxFileSizeMB * BYTES_PER_MB;
    const allowedFileTypes = Array.isArray(assignment.allowedFileTypes)
      ? assignment.allowedFileTypes
      : ["any"];

    if (attachments.length === 0) {
      throw new BadRequestException("Submission must include at least one file");
    }

    if (attachments.length > maxFiles) {
      throw new BadRequestException(`Submission can include at most ${maxFiles} files`);
    }

    for (const attachment of attachments) {
      const size = Number(attachment?.size || 0);
      if (size > maxFileSizeBytes) {
        throw new BadRequestException(
          `Each submission file must be ${maxFileSizeMB}MB or smaller`,
        );
      }

      if (!this.isAllowedFileType(attachment, allowedFileTypes)) {
        throw new BadRequestException(
          `Submission file type is not allowed: ${attachment?.name || "unknown"}`,
        );
      }
    }
  }

  private isAllowedFileType(attachment: any, allowedFileTypes: string[]) {
    if (allowedFileTypes.includes("any")) return true;

    const name = String(attachment?.name || attachment?.fileName || "").toLowerCase();
    const mime = String(attachment?.mimeType || attachment?.fileType || "").toLowerCase();

    return allowedFileTypes.some((type) => {
      if (type === "pdf") return mime === "application/pdf" || name.endsWith(".pdf");
      if (type === "doc") {
        return (
          mime.includes("word") ||
          mime === "text/plain" ||
          name.endsWith(".doc") ||
          name.endsWith(".docx") ||
          name.endsWith(".txt")
        );
      }
      if (type === "sheet") {
        return (
          mime.includes("excel") ||
          mime.includes("spreadsheet") ||
          name.endsWith(".xls") ||
          name.endsWith(".xlsx") ||
          name.endsWith(".csv")
        );
      }
      if (type === "image") return mime.startsWith("image/");
      if (type === "archive") {
        return [".zip", ".rar", ".7z", ".tar", ".gz"].some((ext) =>
          name.endsWith(ext),
        );
      }
      return false;
    });
  }

  private async checkUpcomingDeadlines() {
    if (this.isChecking) return;
    this.isChecking = true;

    try {
      const now = Date.now();
      const maxDeadline = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      let lastEvaluatedKey: any;

      do {
        const result = await this.db.docClient.send(
          new ScanCommand({
            TableName: this.db.tableName,
            FilterExpression:
              "#type = :assignmentType AND attribute_exists(payload.assignment.deadline) AND payload.assignment.deadline <= :maxDeadline",
            ExpressionAttributeNames: {
              "#type": "type",
            },
            ExpressionAttributeValues: {
              ":assignmentType": "assignment",
              ":maxDeadline": maxDeadline,
            },
            ExclusiveStartKey: lastEvaluatedKey,
            Limit: 100,
          }),
        );

        for (const item of result.Items || []) {
          await this.processAssignmentReminder(item);
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    } finally {
      this.isChecking = false;
    }
  }

  private getReminderWindow(deadline: string): AssignmentReminderWindow | null {
    const deadlineTime = new Date(deadline).getTime();
    if (!Number.isFinite(deadlineTime)) return null;

    const remainingMs = deadlineTime - Date.now();
    if (remainingMs <= 0) return null;
    if (remainingMs <= 60 * 60 * 1000) return "1h";
    if (remainingMs <= 24 * 60 * 60 * 1000) return "24h";
    return null;
  }

  private async processAssignmentReminder(item: any) {
    const assignment = item.payload?.assignment;
    if (!assignment?.deadline) return;

    const window = this.getReminderWindow(assignment.deadline);
    if (!window) return;

    const sent = Array.isArray(assignment.reminderSent)
      ? assignment.reminderSent
      : [];
    if (sent.includes(window)) return;

    const metadata = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: item.PK, SK: "METADATA" },
      }),
    );

    const members = Array.isArray(metadata.Item?.members)
      ? metadata.Item.members.map((email: string) => String(email).toLowerCase())
      : [];
    const submissions = assignment.submissions || {};
    const assignees = Array.isArray(assignment.assignees) && assignment.assignees.length > 0
      ? assignment.assignees.map((email: string) => String(email).toLowerCase())
      : members.filter((email: string) => email !== String(item.senderId || "").toLowerCase());

    const recipients = assignees.filter((email: string) => !submissions[email]);
    if (recipients.length === 0) return;

    const title = "Sắp đến hạn bài tập";
    const body =
      window === "1h"
        ? `Bài tập "${assignment.title}" còn dưới 1 giờ.`
        : `Bài tập "${assignment.title}" còn dưới 24 giờ.`;

    await this.notificationService.broadcastNotification(recipients, {
      title,
      body,
      data: {
        convId: item.PK,
        messageId: item.SK,
        type: "assignment_deadline",
        window,
      },
    });

    if (this.chatGateway?.server) {
      for (const email of recipients) {
        this.chatGateway.server.to(`user#${email}`).emit(
          "assignment_deadline_reminder",
          {
            convId: item.PK,
            messageId: item.SK,
            assignment,
            window,
            title,
            body,
          },
        );
      }
    }

    const nextPayload = {
      ...(item.payload || {}),
      assignment: {
        ...assignment,
        reminderSent: [...sent, window],
      },
    };

    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: "SET payload = :payload, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":payload": nextPayload,
          ":updatedAt": new Date().toISOString(),
        },
      }),
    );
  }
}
