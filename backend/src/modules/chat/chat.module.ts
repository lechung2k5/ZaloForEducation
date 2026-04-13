import { forwardRef, Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { MessageService } from './message.service';
import { FriendshipService } from './friendship.service';
import { ChatController } from './chat.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, MessageService, FriendshipService],
  exports: [ChatGateway, ChatService, MessageService, FriendshipService],
})
export class ChatModule {}
