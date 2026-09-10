import { Request, Response, NextFunction } from 'express';
import { generateRAGAnswer } from '../../../utils/rag.util';
import { routeQuery } from '../../../utils/aiRouter.util';
import prisma from '../../../config/prisma.config';
import { AppError } from '../../../utils/AppError';

export const askQuestion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { question, subjectId, batchId, conversationId } = req.body;
    const userId = req.user?.sub;

    if (!userId) {
      throw new AppError('Authentication required.', 401);
    }

    if (!question || typeof question !== 'string') {
       res.status(400).json({
        success: false,
        message: 'Question is required and must be a string',
      });
      return;
    }

    let activeConversationId = conversationId;

    // 1. Validate or create conversation session
    if (activeConversationId) {
      const existing = await prisma.chatConversation.findUnique({
        where: { id: activeConversationId }
      });
      if (!existing) {
        activeConversationId = undefined; // Stale ID, clear it
      }
    }

    if (!activeConversationId) {
      const activeConvo = await prisma.chatConversation.findFirst({
        where: { userId, isActive: true, deletedAt: null },
        orderBy: { createdAt: 'desc' }
      });
      
      if (activeConvo) {
        activeConversationId = activeConvo.id;
      } else {
        const newConvo = await prisma.chatConversation.create({
          data: {
            userId,
            title: question.substring(0, 50) + (question.length > 50 ? '...' : ''),
          }
        });
        activeConversationId = newConvo.id;
      }
    }

    // 2. Insert user message into database
    const userMsg = await prisma.chatMessage.create({
      data: {
        conversationId: activeConversationId,
        role: 'user',
        content: question,
      }
    });

    const filters: { subjectId?: string; batchId?: string; userId?: string } = {};
    if (subjectId) filters.subjectId = subjectId;
    if (batchId) filters.batchId = batchId;
    if (userId) filters.userId = userId;

    // 3 & 4. Send message to AI Router pipeline & Receive response
    const answer = await routeQuery(question, filters);

    // 6. Insert AI response into database
    const aiMsg = await prisma.chatMessage.create({
      data: {
        conversationId: activeConversationId,
        role: 'assistant',
        content: answer,
      }
    });

    res.status(200).json({
      success: true,
      data: {
        conversationId: activeConversationId,
        userMessage: {
          id: userMsg.id,
          role: userMsg.role,
          message: userMsg.content,
          timestamp: userMsg.createdAt,
        },
        answerMessage: {
          id: aiMsg.id,
          role: aiMsg.role,
          message: aiMsg.content,
          timestamp: aiMsg.createdAt,
        },
        answer,
      },
    });
  } catch (error) {
    console.error("Chat Controller Error:", error);
    next(error);
  }
};

export const getSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new AppError('Authentication required.', 401);
    }

    const conversation = await prisma.chatConversation.findFirst({
      where: { userId, isActive: true, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: conversation || { messages: [] }
    });
  } catch (error) {
    console.error("Get Chat Session Error:", error);
    next(error);
  }
};

/**
 * Clear all messages in the active conversation (or archive conversation)
 */
export const clearConversation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new AppError('Authentication required.', 401);
    }

    const { conversationId } = req.body || {};

    if (conversationId) {
      // Delete all messages belonging to this conversation
      await prisma.chatMessage.deleteMany({
        where: { conversationId, conversation: { userId } }
      });
      // Mark conversation as soft-deleted or clean
      await prisma.chatConversation.updateMany({
        where: { id: conversationId, userId },
        data: { deletedAt: new Date(), isActive: false }
      });
    } else {
      // Clear all active conversations for this user
      const activeConversations = await prisma.chatConversation.findMany({
        where: { userId, isActive: true, deletedAt: null },
        select: { id: true }
      });

      const ids = activeConversations.map(c => c.id);
      if (ids.length > 0) {
        await prisma.chatMessage.deleteMany({
          where: { conversationId: { in: ids } }
        });
        await prisma.chatConversation.updateMany({
          where: { id: { in: ids } },
          data: { deletedAt: new Date(), isActive: false }
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully.'
    });
  } catch (error) {
    console.error("Clear Conversation Error:", error);
    next(error);
  }
};

/**
 * Delete a specific message by its ID
 */
export const deleteMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      throw new AppError('Authentication required.', 401);
    }

    const messageId = req.params.messageId as string;
    if (!messageId) {
      throw new AppError('Message ID is required.', 400);
    }

    // Verify message belongs to a conversation owned by the current user
    const message = await prisma.chatMessage.findFirst({
      where: {
        id: messageId,
        conversation: { userId }
      }
    });

    if (!message) {
      throw new AppError('Message not found or unauthorized.', 404);
    }

    await prisma.chatMessage.delete({
      where: { id: messageId }
    });

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully.'
    });
  } catch (error) {
    console.error("Delete Message Error:", error);
    next(error);
  }
};

