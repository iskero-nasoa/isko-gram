import { Request, Response } from "express";
import Supergroup from "../models/Supergroup";
import Topic from "../models/Topic";
import Message from "../models/Message";
import User from "../models/User";
import mongoose from "mongoose";
import { getIO } from "../config/socket";

// Create a supergroup (auto-creates "General" topic)
export const createSupergroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { name, description, memberIds } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Name is required" });
      return;
    }

    // Validate members exist
    const validMembers: mongoose.Types.ObjectId[] = [new mongoose.Types.ObjectId(String(userId))];
    if (memberIds && Array.isArray(memberIds)) {
      for (const id of memberIds) {
        const exists = await User.findById(id);
        if (exists && id !== userId?.toString()) {
          validMembers.push(new mongoose.Types.ObjectId(id));
        }
      }
    }

    const supergroup = await Supergroup.create({
      name: name.trim(),
      description: description?.trim() || "",
      admin: userId,
      members: validMembers,
    });

    // Auto-create "General" topic
    await Topic.create({
      groupId: supergroup._id,
      name: "General",
      description: "Основной топик",
      createdBy: userId,
      messages: [],
    });

    const populated = await supergroup.populate([
      { path: "admin", select: "username avatar" },
      { path: "members", select: "username avatar status" },
    ]);

    // Notify members via socket
    const io = getIO();
    for (const member of validMembers) {
      io.to(`user_${member.toString()}`).emit("supergroup_created", populated);
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to create supergroup", error });
  }
};

// Get all supergroups for current user
export const getSupergroups = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?._id;

    const supergroups = await Supergroup.find({
      members: userId,
    })
      .populate("admin", "username avatar")
      .populate("members", "username avatar status")
      .sort({ updatedAt: -1 });

    res.status(200).json(supergroups);
  } catch (error) {
    res.status(500).json({ message: "Failed to get supergroups", error });
  }
};

// Get single supergroup
export const getSupergroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supergroup = await Supergroup.findById(id)
      .populate("admin", "username avatar")
      .populate("members", "username avatar status");

    if (!supergroup) {
      res.status(404).json({ message: "Supergroup not found" });
      return;
    }

    res.status(200).json(supergroup);
  } catch (error) {
    res.status(500).json({ message: "Failed to get supergroup", error });
  }
};

// Create topic in supergroup
export const createSupergroupTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const { name, description } = req.body;

    const supergroup = await Supergroup.findById(id);
    if (!supergroup) {
      res.status(404).json({ message: "Supergroup not found" });
      return;
    }

    if (supergroup.admin.toString() !== userId?.toString()) {
      res.status(403).json({ message: "Only admin can create topics" });
      return;
    }

    if (!name || !name.trim()) {
      res.status(400).json({ message: "Topic name is required" });
      return;
    }

    const topic = await Topic.create({
      groupId: supergroup._id,
      name: name.trim(),
      description: description?.trim() || "",
      createdBy: userId,
      messages: [],
    });

    const populated = await topic.populate("createdBy", "username avatar");

    const io = getIO();
    io.to(`supergroup_${id}`).emit("topic_created", {
      groupId: id,
      topic: populated,
    });

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to create topic", error });
  }
};

// Get topics for a supergroup
export const getSupergroupTopics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const topics = await Topic.find({ groupId: id })
      .populate("createdBy", "username avatar")
      .populate({
        path: "messages",
        options: { sort: { createdAt: -1 }, limit: 1 },
        populate: { path: "senderId", select: "username avatar" },
      })
      .sort({ createdAt: 1 });

    res.status(200).json(topics);
  } catch (error) {
    res.status(500).json({ message: "Failed to get topics", error });
  }
};

// Get messages for a topic in supergroup
export const getSupergroupTopicMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { topicId } = req.params;
    const skip = parseInt(req.query.skip as string) || 0;
    const limit = parseInt(req.query.limit as string) || 50;

    const messages = await Message.find({
      topicId: new mongoose.Types.ObjectId(topicId as string),
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: "senderId", select: "username avatar" },
        {
          path: "replyTo",
          populate: { path: "senderId", select: "username" },
        },
      ]);

    res.status(200).json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: "Failed to get topic messages", error });
  }
};

// Add member to supergroup
export const addSupergroupMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const { memberId } = req.body;

    const supergroup = await Supergroup.findById(id);
    if (!supergroup) {
      res.status(404).json({ message: "Supergroup not found" });
      return;
    }

    if (supergroup.admin.toString() !== userId?.toString()) {
      res.status(403).json({ message: "Only admin can add members" });
      return;
    }

    if (supergroup.members.some((m) => m.toString() === memberId)) {
      res.status(400).json({ message: "User is already a member" });
      return;
    }

    supergroup.members.push(new mongoose.Types.ObjectId(memberId));
    await supergroup.save();

    const populated = await supergroup.populate("members", "username avatar status");
    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to add member", error });
  }
};

// Update topic
export const updateSupergroupTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, topicId } = req.params;
    const userId = req.user?._id;
    const { name, description } = req.body;

    const supergroup = await Supergroup.findById(id);
    if (!supergroup) {
      res.status(404).json({ message: "Supergroup not found" });
      return;
    }

    if (supergroup.admin.toString() !== userId?.toString()) {
      res.status(403).json({ message: "Only admin can update topics" });
      return;
    }

    const topic = await Topic.findById(topicId);
    if (!topic) {
      res.status(404).json({ message: "Topic not found" });
      return;
    }

    if (name !== undefined) topic.name = name.trim();
    if (description !== undefined) topic.description = description.trim();
    await topic.save();

    const populated = await topic.populate("createdBy", "username avatar");

    const io = getIO();
    io.to(`supergroup_${id}`).emit("topic_updated", { groupId: id, topic: populated });

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update topic", error });
  }
};

// Delete supergroup (admin only)
export const deleteSupergroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    const supergroup = await Supergroup.findById(id);
    if (!supergroup) {
      res.status(404).json({ message: "Supergroup not found" });
      return;
    }

    if (supergroup.admin.toString() !== userId?.toString()) {
      res.status(403).json({ message: "Only admin can delete this supergroup" });
      return;
    }

    const topics = await Topic.find({ supergroupId: new mongoose.Types.ObjectId(id as string) });
    const topicIds = topics.map((t) => t._id);
    await Message.deleteMany({ topicId: { $in: topicIds } });
    await Topic.deleteMany({ supergroupId: new mongoose.Types.ObjectId(id as string) });
    await Supergroup.findByIdAndDelete(id);

    const io = getIO();
    io.to(`supergroup_${id}`).emit("supergroup_deleted", { supergroupId: id });

    res.status(200).json({ message: "Supergroup deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete supergroup", error });
  }
};

// Delete topic
export const deleteSupergroupTopic = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, topicId } = req.params;
    const userId = req.user?._id;

    const supergroup = await Supergroup.findById(id);
    if (!supergroup) {
      res.status(404).json({ message: "Supergroup not found" });
      return;
    }

    if (supergroup.admin.toString() !== userId?.toString()) {
      res.status(403).json({ message: "Only admin can delete topics" });
      return;
    }

    await Message.deleteMany({ topicId: new mongoose.Types.ObjectId(topicId as string) });
    await Topic.findByIdAndDelete(topicId);

    const io = getIO();
    io.to(`supergroup_${id}`).emit("topic_deleted", { groupId: id, topicId });

    res.status(200).json({ message: "Topic deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete topic", error });
  }
};
