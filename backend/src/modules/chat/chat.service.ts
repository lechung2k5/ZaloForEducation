import { Injectable } from '@nestjs/common';


@Injectable()
export class ChatService {
  constructor() { }

  async saveMessage(chatData: any) {
    // Repository logic to save to DynamoDB would go here
    console.log('Saving message to repository...', chatData);
    return chatData;
  }
}
