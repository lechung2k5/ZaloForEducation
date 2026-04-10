const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const bcrypt = require("bcrypt");
require("dotenv").config({ path: "./.env" }); // Chỉnh lại đường dẫn đúng khi chạy từ folder backend

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);
const tableName = process.env.DYNAMODB_TABLE_NAME || "ZaloForEducation";

async function ensureAdmin() {
  const email = "admin@gmail.com";
  const PK = `USER#${email}`;
  const SK = "METADATA";

  console.log(`Checking admin user in table: ${tableName}...`);

  try {
    console.log("Ensuring admin user has hashed password...");
    const passwordHash = await bcrypt.hash("admin123", 12);
    await docClient.send(new PutCommand({
      TableName: tableName,
      Item: {
        PK,
        SK,
        email,
        fullName: "System Admin",
        passwordHash,
        role: "admin",
        createdAt: new Date().toISOString(),
      },
    }));
    console.log("Admin user successfully updated with hashed password on AWS Cloud!");
  } catch (error) {
    console.error("Error ensuring admin user:", error);
  }
}

ensureAdmin();
