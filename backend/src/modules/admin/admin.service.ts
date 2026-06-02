import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BatchWriteCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { DynamoDBService } from "../../infrastructure/dynamodb.service";
import { RedisService } from "../../infrastructure/redis.service";
import { DeviceService } from "../auth/device.service";
import { ChatGateway } from "../chat/chat.gateway";
import { validateDobStrict } from "../../infrastructure/utils/date.util";

type AdminUserInput = {
  email?: string;
  password?: string;
  fullName?: string;
  gender?: boolean;
  dataOfBirth?: string;
  phone?: string;
  address?: string;
  bio?: string;
  role?: "admin" | "user";
};

type NotificationInput = {
  title?: string;
  body?: string;
  targetEmails?: string[];
  sendToAll?: boolean;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DynamoDBService,
    private readonly redisService: RedisService,
    private readonly deviceService: DeviceService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private normalizeEmail(email?: string) {
    return String(email || "").trim().toLowerCase();
  }

  private validatePassword(password: string) {
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new BadRequestException(
        "Mat khau phai toi thieu 8 ky tu, gom chu hoa, chu thuong, so va ky tu dac biet.",
      );
    }
  }

  private toPublicUser(record: Record<string, any>) {
    return {
      email: record.email || String(record.PK || "").replace("USER#", ""),
      fullName: record.fullName || record.fullname || "",
      gender: record.gender ?? true,
      dataOfBirth: record.dataOfBirth || "",
      phone: record.phone || "",
      address: record.address || "",
      bio: record.bio || "",
      avatarUrl: record.avatarUrl || record.urlAvatar || "",
      role: record.role || "user",
      status: record.status || "active",
      isActive: record.isActive !== false,
      isDeleted: record.isDeleted === true,
      createdAt: record.createdAt || "",
      updatedAt: record.updatedAt || "",
      lastLoginAt: record.lastLoginAt || "",
      lockedAt: record.lockedAt || "",
    };
  }

  private async scanUserRecords() {
    const items: Record<string, any>[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const result = await this.db.docClient.send(
        new ScanCommand({
          TableName: this.db.tableName,
          ConsistentRead: true,
          FilterExpression: "begins_with(PK, :userPrefix) AND SK = :sk",
          ExpressionAttributeValues: {
            ":userPrefix": "USER#",
            ":sk": "METADATA",
          },
          ExclusiveStartKey: lastEvaluatedKey,
        }),
      );

      items.push(...((result.Items || []) as Record<string, any>[]));
      lastEvaluatedKey = result.LastEvaluatedKey as Record<string, any> | undefined;
    } while (lastEvaluatedKey);

    return items;
  }

  async listUsers(search = "") {
    const normalizedSearch = search.trim().toLowerCase();
    const records = await this.scanUserRecords();

    const users = records
      .filter((item) => item.isDeleted !== true)
      .map((item) => this.toPublicUser(item));

    if (!normalizedSearch) return { users };

    return {
      users: users.filter((user) =>
        [user.email, user.fullName, user.phone, user.role, user.status]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch),
      ),
    };
  }

  async countUsers() {
    const records = await this.scanUserRecords();
    const users = records
      .filter((item) => item.isDeleted !== true)
      .map((item) => this.toPublicUser(item));

    return {
      userCount: users.length,
      activeUserCount: users.filter((user) => user.status !== "LOCKED").length,
      lockedUserCount: users.filter((user) => user.status === "LOCKED").length,
    };
  }

  async createUser(input: AdminUserInput) {
    const email = this.normalizeEmail(input.email);
    if (!email || !email.includes("@")) {
      throw new BadRequestException("Email khong hop le.");
    }
    if (!input.fullName?.trim()) {
      throw new BadRequestException("Vui long nhap ho ten.");
    }
    if (!input.password) {
      throw new BadRequestException("Vui long nhap mat khau.");
    }
    this.validatePassword(input.password);

    const existing = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: "METADATA" },
      }),
    );
    if (existing.Item) {
      throw new BadRequestException("Email nay da ton tai.");
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = {
      PK: `USER#${email}`,
      SK: "METADATA",
      id: `USER#${email}`,
      email,
      fullName: input.fullName.trim(),
      gender: input.gender ?? true,
      dataOfBirth: input.dataOfBirth ? validateDobStrict(input.dataOfBirth) : "",
      phone: String(input.phone || "").trim(),
      address: String(input.address || "").trim(),
      bio: String(input.bio || "").trim(),
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(input.fullName.trim())}&background=00418f&color=fff`,
      passwordHash,
      role: input.role === "admin" ? "admin" : "user",
      status: "active",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: "",
    };

    await this.db.docClient.send(
      new PutCommand({
        TableName: this.db.tableName,
        Item: user,
      }),
    );

    return { user: this.toPublicUser(user) };
  }

  async updateUser(emailParam: string, input: AdminUserInput) {
    const email = this.normalizeEmail(emailParam);
    const existing = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: "METADATA" },
      }),
    );
    if (!existing.Item) throw new NotFoundException("Khong tim thay nguoi dung.");

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (typeof input.fullName === "string") updates.fullName = input.fullName.trim();
    if (typeof input.gender === "boolean") updates.gender = input.gender;
    if (typeof input.dataOfBirth === "string") {
      updates.dataOfBirth = input.dataOfBirth ? validateDobStrict(input.dataOfBirth) : "";
    }
    if (typeof input.phone === "string") updates.phone = input.phone.trim();
    if (typeof input.address === "string") updates.address = input.address.trim();
    if (typeof input.bio === "string") updates.bio = input.bio.trim();
    if (input.role === "admin" || input.role === "user") updates.role = input.role;
    if (input.password) {
      this.validatePassword(input.password);
      updates.passwordHash = await bcrypt.hash(input.password, 12);
    }

    const names: Record<string, string> = {};
    const values: Record<string, any> = {};
    const expression = Object.entries(updates).map(([key, value]) => {
      names[`#${key}`] = key;
      values[`:${key}`] = value;
      return `#${key} = :${key}`;
    });

    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: "METADATA" },
        UpdateExpression: `SET ${expression.join(", ")}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
      }),
    );

    const updated = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: "METADATA" },
      }),
    );
    this.chatGateway.notifyProfileUpdate(email, this.toPublicUser(updated.Item || {}));
    return { user: this.toPublicUser(updated.Item || {}) };
  }

  async setUserLock(emailParam: string, locked: boolean) {
    const email = this.normalizeEmail(emailParam);
    const now = new Date().toISOString();
    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: "METADATA" },
        UpdateExpression:
          "SET #status = :status, isActive = :isActive, updatedAt = :now, lockedAt = :lockedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":status": locked ? "LOCKED" : "active",
          ":isActive": !locked,
          ":now": now,
          ":lockedAt": locked ? now : "",
        },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
      }),
    );

    if (locked) {
      await this.deviceService.revokeAllSessions(email);
    }

    return { message: locked ? "Da khoa tai khoan." : "Da mo khoa tai khoan." };
  }

  async deleteUser(emailParam: string) {
    const email = this.normalizeEmail(emailParam);
    await this.deviceService.revokeAllSessions(email);

    const result = await this.db.docClient.send(
      new QueryCommand({
        TableName: this.db.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": `USER#${email}` },
      }),
    );

    const deleteRequests = (result.Items || []).map((item) => ({
      DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
    }));

    while (deleteRequests.length > 0) {
      const chunk = deleteRequests.splice(0, 25);
      await this.db.docClient.send(
        new BatchWriteCommand({
          RequestItems: { [this.db.tableName]: chunk },
        }),
      );
    }

    if ((result.Items || []).length === 0) {
      await this.db.docClient.send(
        new DeleteCommand({
          TableName: this.db.tableName,
          Key: { PK: `USER#${email}`, SK: "METADATA" },
        }),
      );
    }

    return { message: "Da xoa tai khoan." };
  }

  async createNotification(actorEmail: string, input: NotificationInput) {
    const title = String(input.title || "").trim();
    const body = String(input.body || "").trim();
    if (!title || !body) {
      throw new BadRequestException("Vui long nhap tieu de va noi dung thong bao.");
    }

    let recipients = (input.targetEmails || [])
      .map((email) => this.normalizeEmail(email))
      .filter(Boolean);

    if (input.sendToAll) {
      recipients = (await this.listUsers()).users.map((user) => user.email);
    }

    recipients = Array.from(new Set(recipients));
    if (recipients.length === 0) {
      throw new BadRequestException("Vui long chon it nhat mot nguoi nhan.");
    }

    const now = new Date().toISOString();
    const id = `NOTIF#${now}#${uuidv4()}`;
    const item = {
      PK: "ADMIN_NOTIFICATION",
      SK: id,
      id,
      title,
      body,
      targetEmails: recipients,
      sentBy: actorEmail,
      sentAt: now,
    };

    await this.db.docClient.send(
      new PutCommand({
        TableName: this.db.tableName,
        Item: item,
      }),
    );

    for (const email of recipients) {
      await this.db.docClient.send(
        new PutCommand({
          TableName: this.db.tableName,
          Item: {
            PK: `USER#${email}`,
            SK: id,
            id,
            title,
            body,
            type: "admin",
            read: false,
            sentBy: actorEmail,
            sentAt: now,
            createdAt: now,
          },
        }),
      );
      this.chatGateway.server.to(`user:${email}`).emit("notification:new", {
        id,
        title,
        body,
        type: "admin",
        sentAt: now,
      });
    }

    return { notification: item };
  }

  async listNotifications() {
    const result = await this.db.docClient.send(
      new QueryCommand({
        TableName: this.db.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": "ADMIN_NOTIFICATION" },
        ScanIndexForward: false,
      }),
    );

    return { notifications: result.Items || [] };
  }

  async getStatistics() {
    const userStats = await this.countUsers();
    const today = new Date().toISOString().slice(0, 10);
    const totalVisits = Number(await this.redisService.get("analytics:visits:total")) || 0;
    const todayVisits = Number(await this.redisService.get(`analytics:visits:${today}`)) || 0;

    return {
      ...userStats,
      totalVisits,
      todayVisits,
    };
  }
}
