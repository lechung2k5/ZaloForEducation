const path = require("path");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const args = process.argv.slice(2);

function getArg(name, fallback) {
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const tableName = getArg("--table", process.env.DYNAMODB_TABLE_NAME || "ZaloForEducation");
const region = getArg("--region", process.env.AWS_REGION || "ap-southeast-1");
const endpoint = getArg("--endpoint", process.env.DYNAMODB_ENDPOINT);
const outputJson = args.includes("--json");

const clientOptions = {
  region,
};

if (endpoint) {
  clientOptions.endpoint = endpoint;
}

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  clientOptions.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientOptions));

function detectType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Set) return "set";
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return "binary";
  return typeof value;
}

function formatExample(value) {
  if (value === undefined) return undefined;

  try {
    const serialized = JSON.stringify(value);
    if (!serialized) return String(value);
    return serialized.length > 120 ? `${serialized.slice(0, 117)}...` : serialized;
  } catch {
    return String(value);
  }
}

function addField(fields, fieldPath, value) {
  if (!fields.has(fieldPath)) {
    fields.set(fieldPath, {
      path: fieldPath,
      count: 0,
      types: new Set(),
      examples: [],
    });
  }

  const field = fields.get(fieldPath);
  field.count += 1;
  field.types.add(detectType(value));

  const example = formatExample(value);
  if (example !== undefined && field.examples.length < 3 && !field.examples.includes(example)) {
    field.examples.push(example);
  }
}

function collectFields(fields, value, currentPath = "") {
  if (!value || typeof value !== "object" || Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (item && typeof item === "object") {
        collectFields(fields, item, `${currentPath}[]`);
      }
    });
    return;
  }

  Object.entries(value).forEach(([key, childValue]) => {
    const fieldPath = currentPath ? `${currentPath}.${key}` : key;
    addField(fields, fieldPath, childValue);

    if (childValue && typeof childValue === "object" && !(childValue instanceof Set)) {
      collectFields(fields, childValue, fieldPath);
    }
  });
}

async function scanAllFields() {
  const fields = new Map();
  let lastEvaluatedKey;
  let scannedCount = 0;
  let page = 0;

  do {
    page += 1;
    const result = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    const items = result.Items || [];
    scannedCount += items.length;
    items.forEach((item) => collectFields(fields, item));
    lastEvaluatedKey = result.LastEvaluatedKey;

    if (!outputJson) {
      process.stderr.write(`Scanned page ${page}, total items: ${scannedCount}\r`);
    }
  } while (lastEvaluatedKey);

  const rows = Array.from(fields.values())
    .map((field) => ({
      path: field.path,
      count: field.count,
      types: Array.from(field.types).sort(),
      examples: field.examples,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

  return {
    tableName,
    region,
    scannedItems: scannedCount,
    totalFields: rows.length,
    fields: rows,
  };
}

function printHumanReport(report) {
  console.error("");
  console.log(`Table: ${report.tableName}`);
  console.log(`Region: ${report.region}`);
  console.log(`Scanned items: ${report.scannedItems}`);
  console.log(`Total fields: ${report.totalFields}`);
  console.log("");
  console.table(
    report.fields.map((field) => ({
      field: field.path,
      count: field.count,
      types: field.types.join(", "),
      examples: field.examples.join(" | "),
    })),
  );
}

scanAllFields()
  .then((report) => {
    if (outputJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    printHumanReport(report);
  })
  .catch((error) => {
    console.error("\nFailed to scan table fields:", error);
    process.exitCode = 1;
  });
