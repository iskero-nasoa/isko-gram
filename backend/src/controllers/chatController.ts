import { Request, Response } from "express";
import Chat from "../models/Chat";
import Message from "../models/Message";
import mongoose from "mongoose";

export const getChats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const chats = await Chat.find({ participants: userId })
      .populate("participants", "username avatar email")
      .populate({
        path: "messages",
        options: { sort: { createdAt: -1 }, limit: 1 },
      })
      .sort({ updatedAt: -1 });

    res.status(200).json(chats);
  } catch (error) {
    res.status(500).json({ message: "Failed to get chats", error });
  }
};

export const getChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId).populate("participants", "username avatar email");
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }
    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: "Failed to get chat", error });
  }
};

export const createDirectChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      res.status(400).json({ message: "Target user ID is required" });
      return;
    }

    if (userId === targetUserId) {
       res.status(400).json({ message: "Cannot create chat with yourself" });
       return;
    }

    // Check if a direct chat already exists
    let chat = await Chat.findOne({
      type: "direct",
      participants: { $all: [userId, targetUserId], $size: 2 }
    }).populate("participants", "username avatar email");

    if (!chat) {
      // Create new chat
      chat = await Chat.create({
        type: "direct",
        participants: [new mongoose.Types.ObjectId(userId), new mongoose.Types.ObjectId(targetUserId)],
        messages: []
      });
      chat = await chat.populate("participants", "username avatar email");
    }

    res.status(200).json(chat);
  } catch (error) {
    res.status(500).json({ message: "Failed to create direct chat", error });
  }
};

export const deleteChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chatId } = req.params;
    const userId = req.user?._id;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    if (!chat.participants.some((p) => p.toString() === userId?.toString())) {
      res.status(403).json({ message: "You are not a participant of this chat" });
      return;
    }

    await Message.deleteMany({ chatId: new mongoose.Types.ObjectId(chatId as string) });
    await Chat.findByIdAndDelete(chatId);

    res.status(200).json({ message: "Chat deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete chat", error });
  }
}
