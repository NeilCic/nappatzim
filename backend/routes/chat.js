import express from "express";
import {
  createDmConversationController,
  listConversationsController,
  listMessagesController,
  sendMessageController,
  markReadController,
} from "../controllers/chatController.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.use(verifyToken);

router.get("/conversations", listConversationsController);

router.post("/conversations", createDmConversationController);

router.get("/conversations/:conversationId/messages", listMessagesController);

router.post("/conversations/:conversationId/messages", sendMessageController);

router.post("/conversations/:conversationId/read", markReadController);

export default router;


