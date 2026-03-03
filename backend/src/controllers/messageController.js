import { Message } from "../models/messageModel.js";
import { User } from "../models/userModel.js"
import cloudinary from "../utils/Cloudinary.js";
import { io, getReceiverSocketId } from "../utils/Socket.io.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user.userId;
    
    // Find all messages where the logged-in user is involved
    const messages = await Message.find({
      $or: [
        { senderId: loggedInUserId },
        { receiverId: loggedInUserId }
      ]
    });
    
    // Extract unique user IDs the logged-in user has chatted with
    const chatUserIds = new Set();
    
    messages.forEach(msg => {
      if (msg.senderId.toString() !== loggedInUserId) {
        chatUserIds.add(msg.senderId.toString());
      }
      if (msg.receiverId.toString() !== loggedInUserId) {
        chatUserIds.add(msg.receiverId.toString());
      }
    });
    
    // Convert Set to Array for the query
    const userIdArray = Array.from(chatUserIds);
    
    // Fetch user details for the sidebar
    const users = await User.find({ 
      _id: { $in: userIdArray }
    }).select("-password");
    
    res.status(200).json(users);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ success: false, message: "Error in getUsersForSidebar" });
  }
};

export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const myId = req.user.userId;

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId },
            ]
        }).sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        console.error("Error in getMessages controller: ", error.message);
        res.status(500).json({ error: "Error in getMessages controller" });
    }
};

export const sendMessages = async (req, res) => {
  try {
    const { text } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user.userId;

    // Validate that the receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    let imageUrl = '';

    // Handle image upload if present
    if (req.file) {
      try {
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: "message_images",
          resource_type: 'auto',
          allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
          transformation: [
            { quality: "auto" },
            { fetch_format: "auto" }
          ]
        });

        imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res.status(500).json({
          success: false,
          message: "Error uploading image",
          error: uploadError.message
        });
      }
    }

    // Validate that either text or image is present
    if (!text && !imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Message must contain either text or an image"
      });
    }

    // Create and save the message
    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || "",
      image: imageUrl
    });

    await newMessage.save();
    
    // Socket.IO notification for real-time message updates
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
      // Emit event to refresh the receiver's sidebar
      io.to(receiverSocketId).emit("refreshSidebar", { senderId });
    }

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: newMessage
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({
      success: false,
      message: "Error sending message",
      error: error.message
    });
  }
};

// Add this function to mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: senderId } = req.params;
    const receiverId = req.user.userId;

    // Update messages
    const result = await Message.updateMany(
      { senderId, receiverId, read: false },
      { $set: { read: true } }
    );
    
    // Notify sender via socket
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("messagesReadByReceiver", receiverId); // Correct event name
    }

    res.status(200).json({ 
      success: true, 
      message: `Marked ${result.modifiedCount} messages as read` 
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error marking messages as read" 
    });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    // Find the message by ID
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Only the sender can delete their own message
    if (message.senderId.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized: You can only delete your own messages" });
    }

    // If the message has an image, attempt to delete it from Cloudinary.
    if (message.image) {
      // Extract the public_id from the Cloudinary URL
      const urlParts = message.image.split('/');
      const fileName = urlParts.pop();
      const publicId = `message_images/${fileName.split('.')[0]}`;
      
      try {
        // Call Cloudinary to delete the image
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryError) {
        console.error("Cloudinary delete error:", cloudinaryError);
        // Continue with message deletion even if image deletion fails
      }
    }

    // Store receiverId before deleting the message
    const { receiverId } = message;
    
    // Remove the message from the database
    await message.deleteOne();

    // Notify about message deletion via Socket.IO
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageDeleted", id);
    }

    return res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    return res.status(500).json({ success: false, message: "Error deleting message", error: error.message });
  }
};