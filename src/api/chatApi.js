import client from './client';
import { supabase } from '../supabaseClient';

/**
 * Fetch chat history for a specific extinguisher
 * GET /api/extinguishers/:id/messages
 */
export const getMessages = async (extinguisherId) => {
    try {
        const response = await client.get(`/extinguishers/${extinguisherId}/messages`);
        return response.data;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw error;
    }
};

/**
 * Send a new message
 * POST /api/extinguishers/:id/messages
 */
export const sendMessage = async (extinguisherId, content) => {
    try {
        const response = await client.post(`/extinguishers/${extinguisherId}/messages`, {
            content,
        });
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};

/**
 * Direct Message APIs (General Customer <-> Partner chat)
 */
export const getDirectMessagesHistory = async (senderId, receiverId, inquiryId = '') => {
    console.group('💬 CHAT API: FETCHING HISTORY');
    console.log('Sender ID:', senderId);
    console.log('Receiver ID:', receiverId);
    console.log('Inquiry ID:', inquiryId);
    console.groupEnd();
    
    try {
        const response = await client.get('/messages', {
            params: { sender_id: senderId, receiver_id: receiverId, inquiry_id: inquiryId }
        });
        console.log('✅ HISTORY FETCHED:', response.data?.data?.length || 0, 'messages found.');
        return response.data?.data || [];
    } catch (error) {
        console.error('❌ HISTORY FETCH ERROR:', error);
        throw error;
    }
};

/**
 * Send a direct message and trigger a notification for the recipient.
 */
export const sendDirectMessage = async (senderId, receiverId, inquiryId, content, senderRole = 'partner', extinguisherId = null, receiverRole = null) => {
    console.group('💬 CHAT API: SENDING MESSAGE');
    console.log('Sender ID:', senderId);
    console.log('Recipient ID:', receiverId);
    console.log('Inquiry ID:', inquiryId);
    console.log('Extinguisher ID:', extinguisherId);
    console.log('Content:', content);
    console.log('Sender Role:', senderRole);
    console.log('Receiver Role:', receiverRole);
    console.groupEnd();

    try {
        // 1. Send the message via API (Backend now handles notification creation)
        const response = await client.post('/messages', {
            sender_id: senderId,
            receiver_id: receiverId,
            // Prefer the actual recipient role the chat box knows (e.g. 'agent' for the
            // Chat-with-Agent flows) — falling back to the old partner<->customer-only
            // assumption only when the caller doesn't pass one, for backward compatibility.
            receiver_role: receiverRole || (senderRole === 'partner' ? 'customer' : 'partner'),
            inquiry_id: inquiryId,
            extinguisher_id: extinguisherId,
            message: content
        });

        console.log("Messages API response:", response.data);

        return response.data?.data;
    } catch (error) {
        console.error('❌ SEND MESSAGE ERROR:', error);
        throw error;
    }
};

export const updateDirectMessageStatus = async (messageId, status) => {
    console.log('🔄 UPDATING MESSAGE STATUS:', messageId, '->', status);
    try {
        const response = await client.patch('/messages/status', {
            message_id: messageId,
            status
        });
        return response.data?.data;
    } catch (error) {
        console.error('❌ STATUS UPDATE ERROR:', error);
        throw error;
    }
};

/**
 * Bulk update message status for a specific conversation
 */
export const markMessagesAsRead = async (messageIds) => {
    if (!messageIds || messageIds.length === 0) return;
    try {
        const promises = messageIds.map(id => updateDirectMessageStatus(id, 'read'));
        await Promise.all(promises);
    } catch (error) {
        console.error('Error marking messages as read:', error);
    }
};
