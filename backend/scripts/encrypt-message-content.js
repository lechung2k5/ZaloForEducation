const path = require("path");
const { createCipheriv, createHash, randomBytes } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const args = process.argv.slice(2);
const marker = "[encrypted:v1]";

function getArg(name, fallback) {
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const tableName = getArg("--table", process.env.DYNAMODB_TABLE_NAME || "ZaloForEducation");
const region = getArg("--region", process.env.AWS_REGION || "ap-southeast-1");
const endpoint = getArg("--endpoint", process.env.DYNAMODB_ENDPOINT);
const shouldWrite = args.includes("--write");

const secret =
  process.env.MESSAGE_ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  "UniChat_message_encryption_fallback";
const key = createHash("sha256").update(secret).digest();

const clientOptions = { region };
if (endpoint) clientOptions.endpoint = endpoint;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientOptions.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientOptions));

function encryptText(value) {
  if (typeof value !== "string" || value.length === 0 || value === marker) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    alg: "aes-256-gcm",
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: data.toString("base64"),
  };
}

function buildUpdate(item) {
  const names = {};
  const values = {};
  const sets = [];

  const encryptedContent = encryptText(item.content);
  if (item.SK?.startsWith("MSG#") && encryptedContent && !item.encryptedContent) {
    names["#content"] = "content";
    names["#encryptedContent"] = "encryptedContent";
    values[":content"] = marker;
    values[":encryptedContent"] = encryptedContent;
    sets.push("#content = :content", "#encryptedContent = :encryptedContent");
  }

  const lastMessageEncryptedContent = encryptText(item.lastMessageContent);
  if (lastMessageEncryptedContent && !item.lastMessageEncryptedContent) {
    names["#lastMessageContent"] = "lastMessageContent";
    names["#lastMessageEncryptedContent"] = "lastMessageEncryptedContent";
    values[":lastMessageContent"] = marker;
    values[":lastMessageEncryptedContent"] = lastMessageEncryptedContent;
    sets.push(
      "#lastMessageContent = :lastMessageContent",
      "#lastMessageEncryptedContent = :lastMessageEncryptedContent",
    );
  }

  const lastMentionEncryptedContent = encryptText(item.lastMentionContent);
  if (lastMentionEncryptedContent && !item.lastMentionEncryptedContent) {
    names["#lastMentionContent"] = "lastMentionContent";
    names["#lastMentionEncryptedContent"] = "lastMentionEncryptedContent";
    values[":lastMentionContent"] = marker;
    values[":lastMentionEncryptedContent"] = lastMentionEncryptedContent;
    sets.push(
      "#lastMentionContent = :lastMentionContent",
      "#lastMentionEncryptedContent = :lastMentionEncryptedContent",
    );
  }

  if (sets.length === 0) return null;

  return {
    Key: { PK: item.PK, SK: item.SK },
    UpdateExpression: `SET ${sets.join(", ")}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

async function run() {
  let lastEvaluatedKey;
  let scanned = 0;
  let matched = 0;
  let updated = 0;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    const items = result.Items || [];
    scanned += items.length;

    for (const item of items) {
      const update = buildUpdate(item);
      if (!update) continue;
      matched += 1;

      if (shouldWrite) {
        await docClient.send(
          new UpdateCommand({
            TableName: tableName,
            ...update,
          }),
        );
        updated += 1;
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
    process.stderr.write(
      `Scanned ${scanned} items, matched ${matched}, updated ${updated}\r`,
    );
  } while (lastEvaluatedKey);

  console.error("");
  console.log(
    JSON.stringify(
      {
        tableName,
        region,
        mode: shouldWrite ? "write" : "dry-run",
        scanned,
        matched,
        updated,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error("\nFailed to encrypt message content:", error);
  process.exitCode = 1;
});
