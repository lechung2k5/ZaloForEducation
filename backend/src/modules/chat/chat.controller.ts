import { Controller, Get, Post, Body, Req, UseGuards, Param, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { MessageService } from './message.service';
import { FriendshipService } from './friendship.service';
// import { AuthGuard } from '../auth/auth.guard'; // Assuming AuthGuard exists

@Controller('api/chat')
// @UseGuards(AuthGuard) // Implement AuthGuard to get req.user
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly messageService: MessageService,
    private readonly friendshipService: FriendshipService
  ) {}

  // --- CONVERSATIONS ---
  @Get('conversations')
  async getInbox(@Req() req: any) {
    // Mock user for now if AuthGuard is not providing it. Later: const email = req.user.email;
    const email = req.user?.email || 'admin@example.com';
    return await this.chatService.getConversationsByUser(email);
  }

  @Post('conversations/direct')
  async createDirect(@Body() body: { targetEmail: string }, @Req() req: any) {
    const email = req.user?.email || 'admin@example.com';
    return await this.chatService.createDirectConversation(email, body.targetEmail);
  }

  @Post('conversations/group')
  async createGroup(@Body() body: { name: string, members: string[] }, @Req() req: any) {
    const email = req.user?.email || 'admin@example.com';
    return await this.chatService.createGroupConversation(email, body.members, body.name);
  }

  // --- MESSAGES ---
  @Get('conversations/:convId/messages')
  async getMessages(@Param('convId') convId: string, @Query('limit') limit: number) {
    return await this.messageService.getMessages(convId, limit || 50);
  }

  @Post('conversations/:convId/messages')
  async sendMessage(
    @Param('convId') convId: string, 
    @Body() body: { content: string, type?: any, media?: any[], files?: any[] }, 
    @Req() req: any
  ) {
    const email = req.user?.email || 'admin@example.com';
    return await this.messageService.sendMessage(convId, email, body.content, body.type, body.media, body.files);
  }

  // --- FRIENDSHIPS ---
  @Get('friends')
  async getFriends(@Req() req: any) {
    const email = req.user?.email || 'admin@example.com';
    return await this.friendshipService.getFriendships(email);
  }

  @Post('friends/request')
  async sendFriendRequest(@Body() body: { targetEmail: string }, @Req() req: any) {
    const email = req.user?.email || 'admin@example.com';
    return await this.friendshipService.sendRequest(email, body.targetEmail);
  }

  @Post('friends/accept')
  async acceptFriendRequest(@Body() body: { senderEmail: string }, @Req() req: any) {
    const email = req.user?.email || 'admin@example.com';
    return await this.friendshipService.acceptRequest(email, body.senderEmail);
  }
}
