import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  forwardRef,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { S3Service } from "../../infrastructure/s3.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProfileCompleteGuard } from "../auth/guards/profile-complete.guard";
import { UserService } from "../user/user.service";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { FriendshipService } from "./friendship.service";
import { MessageService } from "./message.service";
import { NotificationService } from "./notification.service";
import { BotService } from "../bot/bot.service";
import { BOT_EMAIL } from "@zalo-edu/shared";
import { AssignmentService } from "./assignment.service";

@Controller("chat")
@UseGuards(JwtAuthGuard, ProfileCompleteGuard)
export class ChatController {
  constructor(
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => MessageService))
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => FriendshipService))
    private readonly friendshipService: FriendshipService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly s3Service: S3Service,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    private readonly notificationService: NotificationService,
    private readonly botService: BotService,
    private readonly assignmentService: AssignmentService,
  ) {}

  // --- CONVERSATIONS ---
  @Get("conversations")
  async getInbox(@Req() req: any) {
    const email = req.user.email;
    return await this.chatService.getConversationsByUser(email);
  }

  @Get("groups/common")
  async getCommonGroups(
    @Query("email") targetEmail: string,
    @Req() req: any,
  ) {
    if (!targetEmail) throw new BadRequestException("email query param is required");
    return await this.chatService.getCommonGroups(req.user.email, targetEmail);
  }

  @Get("conversations/:id")
  async getConversation(@Param("id") id: string, @Req() req: any) {
    const email = req.user.email;
    return await this.chatService.getConversationById(id, email);
  }

  @Get("search")
  async globalSearch(@Query("q") query: string, @Req() req: any) {
    return await this.chatService.globalSearch(query, req.user.email);
  }

  @Post("conversations/direct")
  async createDirect(@Body() body: { targetEmail: string }, @Req() req: any) {
    const email = req.user.email;
    return await this.chatService.createDirectConversation(
      email,
      body.targetEmail,
    );
  }

  @Post("conversations/group")
  async createGroup(
    @Body()
    body: {
      name: string;
      members?: string[];
      memberEmails?: string[];
      avatar?: string;
    },
    @Req() req: any,
  ) {
    const email = req.user.email;
    const members = body.members || body.memberEmails || [];
    const res = await this.chatService.createGroupConversation(
      email,
      members,
      body.name,
      body.avatar,
    );

    // Send system message
    const sysMsg = await this.messageService.sendMessage(
      res.id,
      "system",
      JSON.stringify({
        action: "group_created",
        actor: email,
        groupName: body.name,
      }),
      "system",
    );

    // Broadcast the system message in real-time to the new group's room and each member's personal room
    try {
      const normalizedConvId = res.id.toLowerCase();
      if (this.chatGateway?.server) {
        let broadcast = this.chatGateway.server.to(normalizedConvId);
        if (Array.isArray(res.members)) {
          for (const member of res.members) {
            const userRoom = `user#${String(member).toLowerCase()}`;
            broadcast = broadcast.to(userRoom);
          }
        }
        broadcast.emit("receiveMessage", sysMsg);
      }
    } catch (e) {
      console.warn(
        "[CHAT] Failed to broadcast group_created system message",
        e,
      );
    }

    return res;
  }

  @Patch("conversations/:id")
  async updateGroupInfo(
    @Param("id") id: string,
    @Body() body: { name?: string; avatar?: string },
    @Req() req: any,
  ) {
    const email = req.user.email;
    const res = await this.chatService.updateGroupInfo(id, email, body);

    if (body.name) {
      const systemMsg = await this.messageService.sendMessage(
        id,
        "system",
        JSON.stringify({
          action: "group_name_updated",
          actor: email,
          newName: body.name,
        }),
        "system",
      );
      this.chatGateway.emitReceiveMessage(id, systemMsg);
    }

    this.chatGateway.emitConversationUpdated(id, body);

    return res;
  }

  @Post("conversations/:id/members")
  async addMembers(
    @Param("id") id: string,
    @Body() body: { members: string[] },
    @Req() req: any,
  ) {
    const email = req.user.email;
    const res = await this.chatService.addMembersToGroup(
      id,
      email,
      body.members,
    );

    for (const target of body.members) {
      const systemMsg = await this.messageService.sendMessage(
        id,
        "system",
        JSON.stringify({
          action: "member_added",
          actor: email,
          target: target,
        }),
        "system",
      );
      this.chatGateway.emitReceiveMessage(id, systemMsg);
    }

    return res;
  }

  @Get("conversations/:id/preview")
  async getGroupPreview(@Param("id") id: string) {
    return await this.chatService.getGroupPreview(id);
  }

  @Post("conversations/:id/join")
  async joinGroup(@Param("id") id: string, @Req() req: any) {
    const email = req.user.email;
    const res = await this.chatService.joinGroupByLink(id, email);

    if (!res.message) {
      // Not already a member
      const systemMsg = await this.messageService.sendMessage(
        id,
        "system",
        JSON.stringify({
          action: "member_joined_link",
          actor: email,
        }),
        "system",
      );
      this.chatGateway.emitReceiveMessage(id, systemMsg);
    }

    return res;
  }

  @Delete("conversations/:id/members/:targetEmail")
  async removeMember(
    @Param("id") id: string,
    @Param("targetEmail") targetEmail: string,
    @Req() req: any,
  ) {
    const email = req.user.email;
    const res = await this.chatService.removeMemberFromGroup(
      id,
      email,
      targetEmail,
    );

    const action =
      String(email).trim().toLowerCase() ===
      String(targetEmail).trim().toLowerCase()
        ? "member_left"
        : "member_kicked";
    const systemMsg = await this.messageService.sendMessage(
      id,
      "system",
      JSON.stringify({
        action,
        actor: email,
        target: targetEmail,
      }),
      "system",
    );
    this.chatGateway.emitReceiveMessage(id, systemMsg);

    return res;
  }

  @Patch("conversations/:id/roles")
  async updateRole(
    @Param("id") id: string,
    @Body() body: { targetEmail: string; role: "deputy" | "member" | "owner" },
    @Req() req: any,
  ) {
    const email = req.user.email;
    const res = await this.chatService.updateMemberRole(
      id,
      email,
      body.targetEmail,
      body.role,
    );

    let action = "role_updated";
    if (body.role === "deputy") action = "promoted_to_deputy";
    if (body.role === "owner") action = "transferred_owner";
    if (body.role === "member") action = "demoted_to_member";

    const systemMsg = await this.messageService.sendMessage(
      id,
      "system",
      JSON.stringify({
        action,
        actor: email,
        target: body.targetEmail,
      }),
      "system",
    );
    this.chatGateway.emitReceiveMessage(id, systemMsg);

    return res;
  }

  @Patch("conversations/:id/settings")
  async updateSettings(
    @Param("id") id: string,
    @Body() body: { isMuted?: boolean; isPinned?: boolean },
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.chatService.updateGroupSettings(id, email, body);
  }

  @Delete("conversations/:id")
  async dissolveGroup(@Param("id") id: string, @Req() req: any) {
    const email = req.user.email;
    return await this.chatService.dissolveGroup(id, email);
  }

  @Get("conversations/:convId/metadata")
  async getMetadata(@Param("convId") convId: string) {
    const res = await this.chatService.getConversationMetadata(convId);
    if (!res) throw new NotFoundException("Conversation metadata not found");
    return res;
  }

  // --- MESSAGES ---
  @Get("conversations/:id/assets")
  async getAssets(
    @Param("id") id: string,
    @Query("type") type: "media" | "file" | "link",
    @Query("limit") limit: number = 20,
    @Query("cursor") cursor: string,
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.messageService.getConversationAssets(
      id,
      email,
      type,
      Number(limit),
      cursor,
    );
  }

  @Get("conversations/:id/messages")
  async getMessages(
    @Param("id") convId: string,
    @Req() req: any,
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string,
    @Query("targetId") targetId?: string,
    @Query("scanForward") scanForward?: string,
  ) {
    const email = req.user.email;
    const isScanForward = scanForward === "true";

    if (targetId) {
      return await this.messageService.getMessagesContext(
        convId,
        targetId,
        email,
        100,
      );
    }

    let lastEvaluatedKey = undefined;
    if (cursor) {
      try {
        lastEvaluatedKey = JSON.parse(
          Buffer.from(cursor, "base64").toString("utf-8"),
        );
      } catch (e) {
        throw new BadRequestException("Invalid pagination cursor");
      }
    }
    return await this.messageService.getMessages(
      convId,
      email,
      limit ? parseInt(limit) : 50,
      lastEvaluatedKey,
      isScanForward,
    );
  }

  @Get("conversations/:id/search")
  async searchMessages(
    @Param("id") id: string,
    @Query("q") query: string,
    @Req() req: any,
  ) {
    const email = req.user.email;
    if (!query || query.trim().length < 2) return [];
    return await this.messageService.searchMessages(id, email, query);
  }

  @Get("conversations/:convId/messages/:messageId")
  async getMessage(
    @Param("convId") convId: string,
    @Param("messageId") messageId: string,
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.messageService.getMessage(convId, messageId, email);
  }

  @Get("conversations/:convId/messages-context/:messageId")
  async getMessagesContext(
    @Param("convId") convId: string,
    @Param("messageId") messageId: string,
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.messageService.getMessagesContext(
      convId,
      messageId,
      email,
    );
  }

  @Post("conversations/:convId/messages")
  async sendMessage(
    @Param("convId") convId: string,
    @Body()
    body: {
      content: string;
      type?: any;
      media?: any[];
      files?: any[];
      mentions?: Array<{ email: string; displayName?: string; start?: number; end?: number }>;
      replyTo?: any;
      contactCard?: {
        email: string;
        fullName?: string;
        avatarUrl?: string;
        phone?: string;
      };
      location?: {
        latitude: number;
        longitude: number;
        label?: string;
        isLive?: boolean;
        liveSessionId?: string;
        sentAt?: string;
        expiresAt?: string;
      };
      audioUrl?: string;
      isVoiceMessage?: boolean;
      payload?: {
        poll?: {
          topic: string;
          options: string[];
          votes?: Record<string, string>;
          allowMultiple?: boolean;
        };
        reminder?: {
          content: string;
          time: string;
          date: string;
          repeatType: "none" | "daily" | "weekly" | "monthly";
        };
        assignment?: {
          title: string;
          description?: string;
          deadline: string;
          assignees?: string[];
          attachments?: any[];
        };
      };
      poll?: {
        topic: string;
        options: string[];
        votes?: Record<string, string>;
        allowMultiple?: boolean;
      };
      reminder?: {
        content: string;
        time: string;
        date: string;
        repeatType: "none" | "daily" | "weekly" | "monthly";
      };
      assignment?: {
        title: string;
        description?: string;
        deadline: string;
        assignees?: string[];
        attachments?: any[];
      };
    },
    @Req() req: any,
  ) {
    const email = req.user.email;
    const isAssignmentMessage =
      body.type === "assignment" ||
      Boolean(body.payload?.assignment || body.assignment);

    if (isAssignmentMessage) {
      const metadata = await this.chatService.getConversationMetadata(convId);
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const ownerEmail = String(metadata?.owner || metadata?.admin || "")
        .trim()
        .toLowerCase();
      const adminEmail = String(metadata?.admin || "")
        .trim()
        .toLowerCase();
      const deputies = Array.isArray(metadata?.deputies)
        ? metadata.deputies.map((deputy) =>
            String(deputy || "").trim().toLowerCase(),
          )
        : [];

      if (metadata?.type !== "group") {
        throw new BadRequestException("Chỉ có thể giao bài tập trong nhóm");
      }

      if (
        normalizedEmail !== ownerEmail &&
        normalizedEmail !== adminEmail &&
        !deputies.includes(normalizedEmail)
      ) {
        throw new BadRequestException(
          "Chỉ trưởng nhóm hoặc phó nhóm mới có quyền giao bài tập",
        );
      }
    }

    const res = await this.messageService.sendMessage(
      convId,
      email,
      body.content,
      body.type,
      body.media,
      body.files,
      body.replyTo,
      {
        // Keep backward compatibility while normalizing poll/reminder into payload.
        ...(!body.payload && (body.poll || body.reminder || body.assignment)
          ? {
              payload: {
                ...(body.poll ? { poll: body.poll } : {}),
                ...(body.reminder ? { reminder: body.reminder } : {}),
                ...(body.assignment ? { assignment: body.assignment } : {}),
              },
            }
          : {}),
        ...(body.contactCard ? { contactCard: body.contactCard } : {}),
        ...(body.location ? { location: body.location } : {}),
        ...(body.audioUrl ? { audioUrl: body.audioUrl } : {}),
        ...(body.isVoiceMessage ? { isVoiceMessage: body.isVoiceMessage } : {}),
        ...(body.payload ? { payload: body.payload } : {}),
        ...(body.mentions?.length ? { mentions: body.mentions } : {}),
        ...(body.mentions?.length ? { mentions: body.mentions } : {}),
      },
    );

    const normalizedConvId = convId.toLowerCase();
    const convMetadata = await this.chatService.getConversationMetadata(convId);

    // 1. BROADCAST REAL-TIME VIA SOCKET
    if (this.chatGateway?.server) {
      let broadcast = this.chatGateway.server.to(normalizedConvId);

      // 2. BROADCAST REAL-TIME TO ALL MEMBERS' PERSONAL ROOMS (For conversation list updates)
      if (convMetadata && convMetadata.members) {
        for (const member of convMetadata.members) {
          // Emit to user#email room so all their devices update the "tab" preview
          const userRoom = `user#${member.toLowerCase()}`;
          broadcast = broadcast.to(userRoom);
        }
      }
      broadcast.emit("receiveMessage", res);
      console.log(`[SOCKET] Broadcasted to room: ${normalizedConvId} and user rooms`);
    } else {
      console.warn(
        `[SOCKET] Skipping real-time broadcast for ${normalizedConvId} - Gateway server not initialized`,
      );
    }

    // 3. SEND PUSH NOTIFICATION (FRAMEWORK READY)
    if (convMetadata) {
      const recipients = convMetadata.members.filter((m) => m !== email);
      const hasSticker =
        Array.isArray(body.media) &&
        body.media.some((item: any) => {
          const mime = String(
            item?.mimeType || item?.fileType || "",
          ).toLowerCase();
          return mime.includes("sticker") || item?.isSticker === true;
        });
      const hasHDImage =
        Array.isArray(body.media) &&
        body.media.some((item: any) => item?.isHD === true);

      const notificationBody =
        body.type === "assignment"
          ? "[Bài tập mới]"
          : body.type === "contact_card"
            ? "[Danh thiếp]"
            : body.type === "location"
              ? "[Vị trí]"
              : body.content ||
                (hasSticker
                  ? "[Sticker]"
                  : hasHDImage
                    ? "[Ảnh HD]"
                    : "[Hình ảnh/Tệp tin]");

      this.notificationService.broadcastNotification(recipients, {
        title: convMetadata.name || "Tin nhắn mới",
        body: notificationBody,
        data: { convId, messageId: res.id },
      });
    }

    // Bot conversation: fire-and-forget
    const botEmailLower = String(BOT_EMAIL).toLowerCase();
    if (normalizedConvId.includes(botEmailLower) && body.type !== "system") {
      this.botService
        .handleIncomingMessage(
          convId,
          email,
          body.content,
          body.media,
          body.files,
        )
        .catch((err) => {
          console.error("[ChatController] Bot handler error:", err);
        });
    }

    return res;
  }

  @Post("conversations/:convId/messages/:messageId/assignment/submit")
  async submitAssignment(
    @Param("convId") convId: string,
    @Param("messageId") messageId: string,
    @Body() body: { note?: string; attachments?: any[] },
    @Req() req: any,
  ) {
    const email = req.user.email;
    const updated = await this.assignmentService.submitAssignment(
      convId,
      messageId,
      email,
      body,
    );

    this.chatGateway.emitMessagePatched(convId, updated);
    return updated;
  }

  @Delete("conversations/:convId/messages/:messageId/assignment/submission")
  async deleteAssignmentSubmission(
    @Param("convId") convId: string,
    @Param("messageId") messageId: string,
    @Req() req: any,
  ) {
    const email = req.user.email;
    const updated = await this.assignmentService.deleteSubmission(
      convId,
      messageId,
      email,
    );

    this.chatGateway.emitMessagePatched(convId, updated);
    return updated;
  }

  @Post("conversations/:convId/messages/:messageId/poll/vote")
  async votePoll(
    @Param("convId") convId: string,
    @Param("messageId") messageId: string,
    @Body("optionIndex", ParseIntPipe) optionIndex: number,
    @Req() req: any,
  ) {
    const email = req.user.email;
    const updated = await this.messageService.votePoll(
      convId,
      messageId,
      email,
      optionIndex,
    );

    this.chatGateway.emitMessagePatched(convId, updated);
    return updated;
  }

  @Post("conversations/:convId/messages/:messageId/poll/close")
  async closePoll(
    @Param("convId") convId: string,
    @Param("messageId") messageId: string,
    @Req() req: any,
  ) {
    const email = req.user.email;
    const updated = await this.messageService.closePoll(
      convId,
      messageId,
      email,
    );

    this.chatGateway.emitMessagePatched(convId, updated);
    return updated;
  }

  @Post("uploads")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: 100 * 1024 * 1024 }, // Max 100MB for the interceptor
    }),
  )
  async uploadChatFile(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    // Secondary validation by type
    if (file.mimetype?.startsWith("image/")) {
      if (file.size > 10 * 1024 * 1024) {
        throw new BadRequestException("Image size cannot exceed 10MB");
      }
    } else if (file.size > 100 * 1024 * 1024) {
      throw new BadRequestException("File/Video size cannot exceed 100MB");
    }

    // Fix encoding for Vietnamese filenames
    const correctName = Buffer.from(file.originalname, "latin1").toString(
      "utf8",
    );
    file.originalname = correctName;

    const folder = file.mimetype?.startsWith("image/")
      ? "chat/images"
      : "chat/files";
    const fileUrl = await this.s3Service.uploadFile(file, folder);

    return {
      name: correctName,
      fileName: correctName,
      mimeType: file.mimetype || "application/octet-stream",
      fileType: file.mimetype || "application/octet-stream",
      size: file.size,
      fileUrl,
      dataUrl: fileUrl,
    };
  }

  @Patch("conversations/:convId/messages/:messageId")
  async patchMessage(
    @Param("convId") convId: string,
    @Param("messageId") messageId: string,
    @Body()
    body: {
      action: "react" | "recall" | "pin" | "unpin" | "deleteForMe";
      reactAction?: "add" | "remove";
      emoji?: string;
      previousEmoji?: string;
    },
    @Req() req: any,
  ) {
    const email = req.user.email;
    const res = await this.messageService.patchMessage(
      convId,
      messageId,
      email,
      body,
    );

    // [SENIOR] BROADCAST REAL-TIME VIA SOCKET (Unified event for Store sync)
    this.chatGateway.emitMessagePatched(convId, res);

    if (this.chatGateway?.server) {
      // [BACKWARD COMPATIBILITY] Specialized events
      if (body.action === "react") {
        this.chatGateway.server.to(convId).emit("message_reaction", {
          messageId,
          reactions: res.reactions,
        });

        // [SENIOR] Emit a virtual system message for the reaction notification
        const emoji = body.emoji || "❤️";
        const senderProfile = await this.userService.getUserProfile(email);
        const senderName = senderProfile?.profile?.fullName || email;
        const systemMsg = {
          id: `SYS_REACT_${Date.now()}_${messageId}`,
          conversationId: convId,
          senderId: "system",
          type: "system",
          content: `${senderName} đã thả cảm xúc ${emoji} về một tin nhắn`,
          createdAt: new Date().toISOString(),
          metadata: {
            targetMessageId: messageId,
            type: "reaction_notification",
          },
        };
        this.chatGateway.server.to(convId).emit("receiveMessage", systemMsg);
      } else if (body.action === "recall") {
        this.chatGateway.server.to(convId).emit("message_recalled", {
          messageId,
          conversationId: convId,
          recalledBy: email,
        });
      } else if (body.action === "pin" || body.action === "unpin") {
        this.chatGateway.server.to(convId).emit("PIN_UPDATE", {
          conversationId: convId,
          pinnedMessageIds: res.pinnedMessageIds,
        });
        // Legacy support if needed
        this.chatGateway.server.to(convId).emit("message_pinned", {
          messageId,
          conversationId: convId,
          pinned: body.action === "pin",
          pinnedBy: email,
        });
      }
    }

    return res;
  }

  // --- FRIENDSHIPS ---
  @Get("friends")
  async getFriends(@Req() req: any) {
    const email = req.user.email;
    return await this.friendshipService.getFriendships(email);
  }

  @Get("friends/search")
  async searchFriend(
    @Req() req: any,
    @Query("email") email?: string,
    @Query("phone") phone?: string,
  ) {
    const myEmail = req.user.email;
    const targetEmail = (email || "").trim().toLowerCase();
    const targetPhone = (phone || "").trim();

    if (!targetEmail && !targetPhone) {
      throw new BadRequestException("Email or Phone is required");
    }

    try {
      let profileData: any = null;

      if (targetEmail) {
        if (targetEmail === myEmail.toLowerCase()) {
          const me = await this.userService.getUserProfile(myEmail);
          return {
            found: true,
            isSelf: true,
            user: me.profile,
            friendship: null,
          };
        }
        profileData = await this.userService.getUserProfile(targetEmail);
      } else if (targetPhone) {
        profileData = await this.userService.getUserByPhone(targetPhone);
        if (!profileData) {
          return {
            found: false,
            isSelf: false,
            user: null,
            friendship: null,
          };
        }
        if (profileData.profile.email.toLowerCase() === myEmail.toLowerCase()) {
          return {
            found: true,
            isSelf: true,
            user: profileData.profile,
            friendship: null,
          };
        }
      }

      const foundUserEmailLower = String(profileData.profile.email).trim().toLowerCase();
      const friendships = await this.friendshipService.getFriendships(myEmail);
      const friendship = friendships.find(
        (item) =>
          (item.sender_id && String(item.sender_id).trim().toLowerCase() === foundUserEmailLower) ||
          (item.receiver_id && String(item.receiver_id).trim().toLowerCase() === foundUserEmailLower),
      );

      return {
        found: true,
        isSelf: false,
        user: profileData.profile,
        friendship: friendship
          ? {
              senderEmail: friendship.sender_id,
              receiverEmail: friendship.receiver_id,
              status: friendship.status,
            }
          : null,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return {
          found: false,
          isSelf: false,
          user: null,
          friendship: null,
        };
      }
      throw error;
    }
  }

  @Post("friends/request")
  async sendFriendRequest(
    @Body() body: { targetEmail: string },
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.friendshipService.sendRequest(email, body.targetEmail);
  }

  @Post("friends/accept")
  async acceptFriendRequest(
    @Body() body: { senderEmail: string },
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.friendshipService.acceptRequest(email, body.senderEmail);
  }

  @Delete("conversations/:id/history")
  async deleteChatHistory(
    @Param("id") id: string,
    @Req() req: any,
    @Query("forEveryone") forEveryone?: string,
  ) {
    const email = req.user.email;
    const isForEveryone = forEveryone === "true";
    const result = await this.messageService.clearHistory(id, email, isForEveryone);
    if (isForEveryone) {
      const metadata = await this.chatService.getConversationMetadata(id);
      if (metadata?.members) {
        for (const member of metadata.members) {
          this.chatGateway.notifyHistoryCleared(member, id);
        }
      }
    } else {
      this.chatGateway.notifyHistoryCleared(email, id);
    }
    return result;
  }

  @Patch("conversations/:id/read")
  async markAsRead(@Param("id") id: string, @Req() req: any) {
    return await this.chatService.markConversationAsRead(req.user.email, id);
  }

  @Patch("conversations/:id/auto-delete")
  async setConversationAutoDelete(
    @Param("id") id: string,
    @Body() body: { days?: number | null },
    @Req() req: any,
  ) {
    const email = req.user.email;
    const result = await this.chatService.setConversationAutoDelete(
      id,
      email,
      body?.days ?? null,
    );

    const metadata = await this.chatService.getConversationMetadata(id);
    if (metadata?.members?.length && this.chatGateway?.server) {
      for (const member of metadata.members) {
        const userRoom = `user#${member.toLowerCase()}`;
        this.chatGateway.server
          .to(userRoom)
          .emit("conversation_auto_delete_updated", {
            convId: id,
            autoDeleteDays: result.autoDeleteDays,
            autoDeleteUpdatedAt: result.autoDeleteUpdatedAt,
            updatedBy: email,
          });
      }
    }

    return result;
  }

  @Post("friends/reject")
  async rejectFriendRequest(
    @Body() body: { senderEmail: string },
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.friendshipService.rejectRequest(email, body.senderEmail);
  }

  @Post("friends/unfriend")
  async unfriend(@Body() body: { friendEmail: string }, @Req() req: any) {
    const email = req.user.email;
    return await this.friendshipService.unfriend(email, body.friendEmail);
  }

  @Post("friends/block")
  async blockUser(@Body() body: { targetEmail: string }, @Req() req: any) {
    const email = req.user.email;
    return await this.friendshipService.blockUser(email, body.targetEmail);
  }

  @Post("friends/unblock")
  async unblockUser(@Body() body: { targetEmail: string }, @Req() req: any) {
    const email = req.user.email;
    return await this.friendshipService.unblockUser(email, body.targetEmail);
  }

  @Patch("friends/nickname")
  async setNickname(
    @Body() body: { friendEmail: string; nickname: string },
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.friendshipService.setNickname(
      email,
      body.friendEmail,
      body.nickname,
    );
  }

  @Patch("friends/close-friend")
  async setCloseFriend(
    @Body() body: { friendEmail: string; isCloseFriend: boolean },
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.friendshipService.setCloseFriend(
      email,
      body.friendEmail,
      body.isCloseFriend,
    );
  }

  // Backward-compatible alias route
  @Patch("friends/closeFriend")
  async setCloseFriendAlias(
    @Body()
    body: {
      friendEmail: string;
      isCloseFriend?: boolean;
      closeFriend?: boolean;
    },
    @Req() req: any,
  ) {
    const email = req.user.email;
    return await this.friendshipService.setCloseFriend(
      email,
      body.friendEmail,
      Boolean(
        body.isCloseFriend !== undefined
          ? body.isCloseFriend
          : body.closeFriend,
      ),
    );
  }

  @Get("friends/requests")
  async getIncomingRequests(@Req() req: any) {
    const email = req.user.email;
    return await this.friendshipService.getIncomingRequests(email);
  }

  @Get("friends/suggestions")
  async getFriendSuggestions(@Req() req: any) {
    const email = req.user.email;
    return await this.friendshipService.getFriendSuggestions(email);
  }

  @Post("friends/suggestions/dismiss")
  async dismissFriendSuggestion(
    @Req() req: any,
    @Body("targetEmail") targetEmail: string,
  ) {
    const email = req.user.email;
    if (!targetEmail) {
      throw new BadRequestException("targetEmail is required");
    }
    return await this.friendshipService.dismissSuggestion(email, targetEmail);
  }
}
