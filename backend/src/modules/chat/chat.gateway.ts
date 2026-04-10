import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('sendMessage')
  handleMessage(@MessageBody() data: any): void {
    // Logic gửi tin nhắn real-time
    this.server.emit('receiveMessage', data);
  }

  // Gửi thông báo đăng xuất tới các thiết bị cũ của User
  notifyForceLogout(userId: string, newDeviceId: string) {
    // Trong thực tế, chúng ta sẽ join user vào room theo userId
    // server.to(`user#${userId}`).emit('force_logout', { newDeviceId });
    this.server.emit(`force_logout_${userId}`, { newDeviceId });
    console.log(`Sent force_logout to user ${userId}`);
  }
}
