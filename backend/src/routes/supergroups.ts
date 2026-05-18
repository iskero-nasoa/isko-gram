import { Router } from "express";
import {
  createSupergroup,
  getSupergroups,
  getSupergroup,
  deleteSupergroup,
  createSupergroupTopic,
  getSupergroupTopics,
  getSupergroupTopicMessages,
  addSupergroupMember,
  updateSupergroupTopic,
  deleteSupergroupTopic,
} from "../controllers/supergroupController";
import { authMiddleware } from "../middleware/auth";

const router = Router();

router.use(authMiddleware);

router.post("/", createSupergroup);
router.get("/", getSupergroups);
router.get("/:id", getSupergroup);
router.delete("/:id", deleteSupergroup);
router.post("/:id/topics", createSupergroupTopic);
router.get("/:id/topics", getSupergroupTopics);
router.get("/:id/topics/:topicId/messages", getSupergroupTopicMessages);
router.post("/:id/members", addSupergroupMember);
router.put("/:id/topics/:topicId", updateSupergroupTopic);
router.delete("/:id/topics/:topicId", deleteSupergroupTopic);

export default router;
