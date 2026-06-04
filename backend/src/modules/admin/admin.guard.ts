import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { DynamoDBService } from "../../infrastructure/dynamodb.service";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly db: DynamoDBService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const email = request.user?.email;

    if (!email) {
      throw new ForbiddenException("Yeu cau quyen quan tri vien.");
    }

    const result = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: "METADATA" },
      }),
    );

    const role = String(result.Item?.role || "").toLowerCase();
    if (role !== "admin") {
      throw new ForbiddenException("Chi quan tri vien moi duoc phep thuc hien thao tac nay.");
    }

    return true;
  }
}
