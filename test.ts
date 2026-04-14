// test mongo
import mongoose from "mongoose";

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected MongoDB");
}

test();