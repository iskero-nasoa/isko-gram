import { Request, Response } from "express";
import Message from "../models/Message";
import Chat from "../models/Chat";
import mongoose from "mongoose";
import User from "../models/User";
import DeletedMessage from "../models/DeletedMessage";
import { getIO } from "../config/socket";

export const sendMessage = async (
  chatId: string, 
  text: string, 
  senderId: string | mongoose.Types.ObjectId,
  attachments?: any[],
  replyTo?: string | mongoose.Types.ObjectId
) => {
  if (!text.trim() && (!attachments || attachments.length === 0)) {
    throw new Error("Message text or attachments must be provided");
  }

  const message = await Message.create({
    chatId: new mongoose.Types.ObjectId(chatId),
    senderId: new mongoose.Types.ObjectId(senderId),
    text,
    attachments: attachments || [],
    replyTo: replyTo ? new mongoose.Types.ObjectId(replyTo) : undefined,
  });

  await Chat.findByIdAndUpdate(chatId, {
    $push: { messages: message._id },
  });

  return await message.populate([
    { path: "senderId", select: "username avatar" },
    { 
      path: "replyTo", 
      populate: { path: "senderId", select: "username" } 
    }
  ]);
};

export const createMessageRest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chatId, text, attachments, replyTo } = req.body;
    const senderId = req.user?._id;

    if (!senderId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const message = await sendMessage(chatId, text, senderId, attachments, replyTo);
    res.status(201).json(message);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to send message", error });
  }
};

export const getMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const userId = req.user?._id;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 50;

    // 1. Get IDs of messages this user has deleted for themselves
    const deletedForMe = await DeletedMessage.find({ userId }).distinct("messageId");

    // 2. Fetch messages excluding those in deletedForMe
    const messages = await Message.find({ 
      chatId,
      _id: { $nin: deletedForMe } 
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: "senderId", select: "username avatar" },
        { 
          path: "replyTo", 
          populate: { path: "senderId", select: "username" } 
        }
      ]);

    // Reversing so oldest is first if frontend expects chronological order
    res.status(200).json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: "Failed to get messages", error });
  }
};

export const deleteMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    const isOwner = message.senderId.toString() === userId.toString();
    const forEveryone = req.body?.forEveryone === true;

    if (isOwner && forEveryone) {
      // Hard delete — remove for everyone
      await Message.findByIdAndDelete(messageId);
      await Chat.findByIdAndUpdate(message.chatId, { $pull: { messages: messageId } });

      const io = getIO();
      io.to(message.chatId.toString()).emit("message_deleted", messageId);

      res.status(200).json({ message: "Message deleted for everyone", messageId, type: "hard" });
    } else {
      // Soft delete — hide only for this user
      await DeletedMessage.findOneAndUpdate(
        { userId, messageId },
        { userId, messageId, deletedAt: new Date() },
        { upsert: true }
      );

      res.status(200).json({ message: "Message hidden for you", messageId, type: "soft" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to delete message", error });
  }
};

export const editMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user?._id;
    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    if (message.senderId.toString() !== userId.toString()) {
      res.status(403).json({ message: "You can only edit your own messages" });
      return;
    }

    message.text = text;
    await message.save();

    res.status(200).json(message);
  } catch (error) {
    res.status(500).json({ message: "Failed to edit message", error });
  }
};
