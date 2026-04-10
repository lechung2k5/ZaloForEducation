const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");
require("dotenv").config({ path: "./.env" });

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.DYNAMODB_TABLE_NAME || "ZaloForEducation";

async function debugAdmin() {
  const email = "admin@gmail.com";
  try {
    const result = await docClient.send(new GetCommand({
      TableName: tableName,
      Key: { PK: `USER#${email}`, SK: "METADATA" },
    }));
    console.log("Admin Data on Cloud:", JSON.stringify(result.Item, null, 2));
  } catch (error) {
    console.error("Debug Error:", error);
  }
}

debugAdmin();
