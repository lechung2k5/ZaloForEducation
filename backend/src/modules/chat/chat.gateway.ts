import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('join_room')
  handleJoinRoom(@MessageBody() data: { convId: string }, @ConnectedSocket() client: Socket): void {
    client.join(data.convId);
    console.log(`Client ${client.id} joined room: ${data.convId}`);
  }

  @SubscribeMessage('join_identity')
  handleJoinIdentity(@MessageBody() data: { email: string }, @ConnectedSocket() client: Socket): void {
    if (data.email) {
      const userRoom = `user#${data.email}`;
      client.join(userRoom);
      console.log(`Client ${client.id} identified as ${data.email}, joined room ${userRoom}`);
    }
  }

  @SubscribeMessage('sendMessage')
  handleMessage(@MessageBody() data: { convId: string, message: any }): void {
    // Broadcast message to everyone in the conversation room
    this.server.to(data.convId).emit('receiveMessage', data.message);
  }

  // Gửi thông báo đăng xuất tới các thiết bị cũ của User qua phòng riêng
  notifyForceLogout(email: string, targetDeviceId: string) {
    const userRoom = `user#${email}`;
    this.server.to(userRoom).emit(`force_logout_${email}`, { targetDeviceId });
    // Also emit a generic force_logout if clients prefer that
    this.server.to(userRoom).emit('force_logout', { targetDeviceId });
    
    console.log(`Sent force_logout to room ${userRoom} for device ${targetDeviceId}`);
  }

  notifySessionsUpdate(email: string) {
    const userRoom = `user#${email}`;
    this.server.to(userRoom).emit('sessions_update', { timestamp: Date.now() });
    console.log(`Sent sessions_update to room ${userRoom}`);
  }
}
