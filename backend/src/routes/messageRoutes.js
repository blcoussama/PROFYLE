import express from 'express';
import { VerifyToken } from '../middlewares/verifyToken.js';
import { deleteMessage, getMessages, getUsersForSidebar, markMessagesAsRead, sendMessages } from '../controllers/messageController.js';
import { uploadMessageImage } from '../middlewares/messageMulter.js';

const router = express.Router();

router.get("/users", VerifyToken, getUsersForSidebar);
router.get("/:id", VerifyToken, getMessages);
router.post("/send/:id", VerifyToken, uploadMessageImage, sendMessages);
router.delete("/delete/:id", VerifyToken, deleteMessage);
router.put("/read/:id", VerifyToken, markMessagesAsRead);

export default router;