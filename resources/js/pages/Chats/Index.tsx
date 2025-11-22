// Declare custom window property for scroll restoration
declare global {
    interface Window {
        __chatapp_scroll_restore?: {
            previousScrollTop: number;
            previousScrollHeight: number;
        } | null;
    }
}
import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface User {
    id: number;
    name: string;
    email: string;
}

interface ChatsProps {
    auth: {
        user: User;
    };
    receiver_id?: number;
    initialConversation?: Conversation;
    initialMessages?: Message[];
    initialConversations?: Conversation[];
    hasMoreMessages?: boolean;
}

interface Conversation {
    id: number;
    other_user: User;
    last_message: {
        id: number;
        content: string;
        created_at: string;
        is_mine: boolean;
        is_read: boolean;
    } | null;
    unread_count: number;
    updated_at: string;
}

interface Message {
    id: number;
    content: string | null;
    sender: User;
    is_mine: boolean;
    is_read: boolean;
    created_at: string;
    attachment_path?: string | null;
    attachment_type?: string | null;
    attachment_url?: string | null;
    unsent?: boolean;
}

export default function Chats({ auth, receiver_id, initialConversation, initialMessages, initialConversations = [], hasMoreMessages: initialHasMore = false }: ChatsProps) {
    const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
    const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(initialConversation || null);
    const [messages, setMessages] = useState<Message[]>(initialMessages || []);
    const [message, setMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(initialConversations.length === 0);
    const [isSending, setIsSending] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [showUserList, setShowUserList] = useState(false);
    const [receiverIdFromUrl, setReceiverIdFromUrl] = useState<number | undefined>(receiver_id);
    const [newChatReceiver, setNewChatReceiver] = useState<User | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [searchResults, setSearchResults] = useState<{conversations: Conversation[], users: User[]}>({conversations: [], users: []});
    const [isSearching, setIsSearching] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [hasMoreMessages, setHasMoreMessages] = useState(initialHasMore);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const hasScrolledInitially = useRef(false);
    const isSwitchingConversation = useRef(false);
    const isLoadingMoreMessages = useRef(false);
    const wasAtBottomRef = useRef(false);
    const pendingScrollIdsRef = useRef<number[]>([]);
    // If the page was hard-refreshed, we want to mark messages as seen on load
    const isHardRefreshRef = useRef(false);

    // Detect hard reload early using useLayoutEffect so that other effects (like the messages effect)
    // see the correct value synchronously during mount.
    useLayoutEffect(() => {
        try {
            const navEntries = (performance && (performance.getEntriesByType)) ? performance.getEntriesByType('navigation') : [];
            if (navEntries && navEntries.length > 0) {
                const nav = navEntries[0] as PerformanceNavigationTiming;
                isHardRefreshRef.current = (nav.type === 'reload');
            } else if ((performance as any).navigation) {
                // fallback for older browsers
                isHardRefreshRef.current = (performance as any).navigation.type === 1;
            }
        } catch (e) {
            // ignore
        }
    }, []);
    const [messageMenuOpen, setMessageMenuOpen] = useState<number | null>(null);
    // New message popup & pending seen tracking
    const [newMessageCount, setNewMessageCount] = useState(0);
    const [showNewMessagePopup, setShowNewMessagePopup] = useState(false);
    const pendingSeenIdsRef = useRef<number[]>([]);
    const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
    const audioUnlockedRef = useRef<boolean>(false);

    // Initialize notification sound and unlock audio on first user interaction
    useEffect(() => {
        notificationAudioRef.current = new Audio('/notification.mp3');
        notificationAudioRef.current.volume = 0.5;

        // Unlock audio on first user interaction
        const unlockAudio = () => {
            if (!audioUnlockedRef.current && notificationAudioRef.current) {
                // Play and immediately pause to unlock audio context
                notificationAudioRef.current.play()
                    .then(() => {
                        notificationAudioRef.current!.pause();
                        notificationAudioRef.current!.currentTime = 0;
                        audioUnlockedRef.current = true;
                    })
                    .catch(() => {
                        // Ignore errors during unlock
                    });
            }
        };

        // Listen for any user interaction to unlock audio
        const events = ['click', 'touchstart', 'keydown'];
        events.forEach(event => {
            document.addEventListener(event, unlockAudio, { once: true });
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, unlockAudio);
            });
        };
    }, []);

    // Function to play notification sound - wrapped in useCallback to prevent recreating
    const playNotificationSound = useCallback(() => {
        try {
            if (!audioUnlockedRef.current) {
                return;
            }

            // Use the preloaded audio instance
            if (notificationAudioRef.current) {
                notificationAudioRef.current.currentTime = 0;
                notificationAudioRef.current.play().catch(() => {
                    // Silently ignore errors
                });
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // Silently ignore errors
        }
    }, []);

    // Scroll to bottom of messages (attempt container scroll first, fallback to end ref)
    const scrollToBottom = (smooth = true) => {
        try {
            const container = messagesContainerRef.current;
            if (container) {
                if ((container as any).scrollTo) {
                    container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
                } else {
                    container.scrollTop = container.scrollHeight;
                }
                return;
            }
        } catch (e) {
            // ignore
        }

        // Fallback to scrollIntoView
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    };

    // Schedule a scroll to bottom after the next paint(s) to ensure DOM updates have occurred
    const scheduleScrollToBottom = (smooth = true) => {
        try {
            requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom(smooth)));
        } catch (e) {
            // fallback
            setTimeout(() => scrollToBottom(smooth), 50);
        }
    };

    // Debug helper to POST message seen with tracing — keeps a single place to observe when /messages/{id}/seen is called
    const debugPostSeen = async (id: number, origin = 'unknown') => {
        try {
            console.debug('[debug] postSeen', { id, origin, isSwitching: isSwitchingConversation.current, scrollTop: messagesContainerRef.current?.scrollTop, scrollHeight: messagesContainerRef.current?.scrollHeight, clientHeight: messagesContainerRef.current?.clientHeight });
        } catch (e) {
            // ignore logging errors
        }

        try {
            await axios.post(`/messages/${id}/seen`);
        } catch (e) {
            console.error('[debug] postSeen error', e);
        }
    };

    // Debug wrapper for incrementing the new-message popup counter so we can see when it changes
    const incNewMessageCount = (n: number, origin = 'unknown') => {
        try {
            console.debug('[debug] incNewMessageCount', { n, origin, isSwitching: isSwitchingConversation.current, pending: pendingSeenIdsRef.current.length });
        } catch (e) {}
        setNewMessageCount(c => c + n);
    };

    // Load conversations
    const loadConversations = useCallback(async () => {
        try {
            const response = await axios.get('/conversations');
            setConversations(response.data);
            setIsLoading(false);
        } catch (error) {
            console.error('Error loading conversations:', error);
            setIsLoading(false);
        }
    }, []);

    // Load messages for a conversation
    const loadMessages = useCallback(async (conversationId: number, markOnOpen = false) => {
        setIsLoadingMessages(true);
        isSwitchingConversation.current = true;
        // Clear any pending new-message UI when switching conversations —
        // pending IDs are per conversation and should not leak between views.
        pendingSeenIdsRef.current = [];
        setNewMessageCount(0);
        setShowNewMessagePopup(false);

        try {
            const response = await axios.get(`/conversations/${conversationId}`);
            setMessages(response.data.messages);
            setHasMoreMessages(response.data.has_more || false);
            setSelectedConversation(conversations.find(c => c.id === conversationId) || null);
            setIsLoadingMessages(false);

            // Multiple instant scroll attempts to ensure we reach bottom after content loads
            const scrollToEnd = () => {
                if (messagesContainerRef.current) {
                    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
                }
            };

            // Immediate scroll
            scrollToEnd();

            // Multiple delayed scrolls to catch late-loading content
            setTimeout(scrollToEnd, 0);
            setTimeout(scrollToEnd, 50);
            setTimeout(scrollToEnd, 150);

            // Reset flag after all scrolls
            setTimeout(() => {
                isSwitchingConversation.current = false;
            }, 200);

            // Determine unseen messages from the loaded response
            const unseenIds: number[] = (response.data.messages || [])
                .filter((m: any) => !m.is_mine && !m.is_read)
                .map((m: any) => m.id);

            // After scrolling attempts, decide behavior:
            // - If this was a hard refresh, mark unseen messages immediately.
            // - If the user explicitly opened the conversation (markOnOpen === true), mark them as seen.
            // - Otherwise, queue them to be marked when the user scrolls to bottom or clicks the popup.
            setTimeout(async () => {
                if (unseenIds.length > 0) {
                    if (isHardRefreshRef.current) {
                        try {
                            await Promise.all(unseenIds.map((id: number) => debugPostSeen(id, 'hardRefresh')));
                        } catch (e) { /* ignore */ }
                        try { loadConversations(); } catch (e) { /* ignore */ }
                        isHardRefreshRef.current = false;
                    } else if (markOnOpen) {
                        // User opened the conversation manually — mark loaded unseen messages as seen
                        try {
                            await Promise.all(unseenIds.map((id: number) => debugPostSeen(id, 'openConversation')));
                        } catch (e) { /* ignore */ }
                        try { loadConversations(); } catch (e) { /* ignore */ }
                    } else {
                        // Queue unseen IDs so they will be marked when the user scrolls manually or clicks the popup.
                        pendingSeenIdsRef.current.push(...unseenIds);
                    }
                } else {
                    // No unseen messages; refresh conversations to ensure counts are correct
                    try { loadConversations(); } catch (e) { /* ignore */ }
                }
            }, 150);
        } catch (error) {
            console.error('Error loading messages:', error);
            setIsLoadingMessages(false);
        }
    }, [conversations, loadConversations]);

    // Load more messages (pagination)
    const loadMoreMessages = useCallback(async () => {
        if (!selectedConversation || isLoadingMore || !hasMoreMessages) return;

        setIsLoadingMore(true);
        isLoadingMoreMessages.current = true;
        const oldestMessageId = messages.length > 0 ? messages[0].id : null;
        // Store scroll position before fetching
        const container = messagesContainerRef.current;
        const previousScrollHeight = container?.scrollHeight || 0;
        const previousScrollTop = container?.scrollTop || 0;
        try {
            const response = await axios.get(`/conversations/${selectedConversation.id}/load-more`, {
                params: { before_id: oldestMessageId }
            });
            if (response.data.messages.length > 0) {
                // Add older messages to the beginning
                setMessages(prevMessages => [...response.data.messages, ...prevMessages]);
                setHasMoreMessages(response.data.has_more);
                // Save scroll restoration info for useEffect
                window.__chatapp_scroll_restore = {
                    previousScrollTop,
                    previousScrollHeight
                };
            } else {
                isLoadingMoreMessages.current = false;
            }
        } catch (error) {
            console.error('Error loading more messages:', error);
            isLoadingMoreMessages.current = false;
        } finally {
            setIsLoadingMore(false);
        }
    }, [selectedConversation, messages, hasMoreMessages, isLoadingMore]);

    // Handle scroll to detect when user reaches top and show/hide scroll button
    const handleScroll = useCallback(() => {
        const container = messagesContainerRef.current;
        if (!container) return;

        // Load more messages when scrolled to top
        if (container.scrollTop === 0 && hasMoreMessages && !isLoadingMore) {
            loadMoreMessages();
        }

        // Show scroll button when not at bottom
        const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
        setShowScrollButton(!isAtBottom);

        // If we've scrolled to bottom and there are pending unseen messages, mark them as seen
        // BUT do not mark while we're in the middle of a programmatic conversation switch
        // (isSwitchingConversation is set true during loadMessages and false shortly after)
        if (isAtBottom && pendingSeenIdsRef.current.length > 0 && !isSwitchingConversation.current) {
            markPendingAsSeen();
        }
    }, [hasMoreMessages, isLoadingMore, loadMoreMessages]);

    // Load all users
    const loadUsers = async () => {
        try {
            const response = await axios.get('/users');
            setAllUsers(response.data);
        } catch (error) {
            console.error('Error loading users:', error);
        }
    };

    // Perform search on server
    const performSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults({conversations: [], users: []});
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            const response = await axios.get('/search', {
                params: { q: query }
            });
            setSearchResults(response.data);
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchQuery) {
                performSearch(searchQuery);
            } else {
                setSearchResults({conversations: [], users: []});
                setIsSearching(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [searchQuery, performSearch]);

    // Handle emoji selection
    const handleEmojiClick = (emojiData: EmojiClickData) => {
        setMessage(prev => prev + emojiData.emoji);
        setShowEmojiPicker(false);
    };

    // Handle file selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);

            // Create preview for images and videos
            const reader = new FileReader();
            reader.onload = (e) => {
                setFilePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Clear file selection
    const clearFileSelection = () => {
        setSelectedFile(null);
        setFilePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Delete message for me
    const handleDeleteForMe = async (messageId: number) => {
        try {
            await axios.delete(`/messages/${messageId}/delete-for-me`);
            setMessages(prev => prev.filter(msg => msg.id !== messageId));
            setMessageMenuOpen(null);
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    };

    // Unsend message (delete for everyone)
    const handleUnsend = async (messageId: number) => {
        try {
            await axios.delete(`/messages/${messageId}/unsend`);
            setMessages(prev => prev.map(msg =>
                msg.id === messageId
                    ? { ...msg, content: null, attachment_path: null, attachment_type: null, attachment_url: null, unsent: true }
                    : msg
            ));
            setMessageMenuOpen(null);
        } catch (error) {
            console.error('Error unsending message:', error);
        }
    };

    // Delete conversation
    const handleDeleteConversation = async () => {
        if (!selectedConversation) return;

        if (confirm('Delete this conversation? Messages will only be deleted for you.')) {
            try {
                await axios.delete(`/conversations/${selectedConversation.id}/delete`);
                // The conversation will be removed via WebSocket event listener
                // Redirect to root so the user is not left on a deleted conversation
                setSelectedConversation(null);
                setMessages([]);
                router.get('/');
            } catch (error) {
                console.error('Error deleting conversation:', error);
            }
        }
    };

    // Send message
    const handleSendMessage = async () => {
        if ((!message.trim() && !selectedFile) || isSending) return;

        // Determine receiver ID
        let receiverId: number;
        if (selectedConversation) {
            receiverId = selectedConversation.other_user.id;
        } else if (newChatReceiver) {
            receiverId = newChatReceiver.id;
        } else {
            return;
        }

        setIsSending(true);
        try {
            const formData = new FormData();
            formData.append('receiver_id', receiverId.toString());
            formData.append('content', message.trim());

            if (selectedFile) {
                formData.append('attachment', selectedFile);
            }

            const response = await axios.post('/messages', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Add message to list
            const newMessage: Message = {
                id: response.data.message.id,
                content: response.data.message.content,
                sender: auth.user,
                is_mine: true,
                is_read: false,
                created_at: response.data.message.created_at,
                attachment_path: response.data.message.attachment_path,
                attachment_type: response.data.message.attachment_type,
                attachment_url: response.data.message.attachment_url,
            };

            try {
                const container = messagesContainerRef.current;
                wasAtBottomRef.current = container ? (container.scrollHeight - container.scrollTop - container.clientHeight) < 100 : false;
            } catch (e) { wasAtBottomRef.current = false; }

            setMessages(prev => {
                // push pending id after state update; use functional set to avoid stale state
                return [...prev, newMessage];
            });

            // If message has attachment and user was at bottom, mark pending so we scroll after media loads
            if (newMessage.attachment_url && wasAtBottomRef.current) {
                pendingScrollIdsRef.current.push(newMessage.id);
                try {
                    console.debug('[debug] sent message pendingScroll push', { id: newMessage.id, wasAtBottom: wasAtBottomRef.current, pending: pendingScrollIdsRef.current.slice() });
                } catch (e) {}

                // Fallback: schedule an extra scroll after a short delay in case media load events or RAF miss it
                setTimeout(() => {
                    try { console.debug('[debug] sent message fallback scroll', { id: newMessage.id, pending: pendingScrollIdsRef.current.slice(), scrollHeight: messagesContainerRef.current?.scrollHeight }); } catch (e) {}
                    scheduleScrollToBottom(false);
                }, 250);
            }

            setMessage('');
            clearFileSelection();

            // If this was a new chat, reload conversations and select it
            if (newChatReceiver) {
                const conversationsResponse = await axios.get('/conversations');
                const updatedConversations = conversationsResponse.data;
                setConversations(updatedConversations);

                const newConversation = updatedConversations.find(
                    (c: Conversation) => c.other_user.id === receiverId
                );
                if (newConversation) {
                    setSelectedConversation(newConversation);
                }
                setNewChatReceiver(null);
            } else {
                // Refresh conversations to update last message
                loadConversations();
            }
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setIsSending(false);
        }
    };

    // Prepare to start conversation with user (don't send message yet)
    const prepareNewChat = async (userId: number) => {
        try {
            // Get user details - check allUsers first, otherwise fetch
            let user = allUsers.find(u => u.id === userId);

            if (!user) {
                // Fetch all users if not loaded yet
                const response = await axios.get('/users');
                setAllUsers(response.data);
                user = response.data.find((u: User) => u.id === userId);
            }

            if (!user) {
                console.error('User not found');
                return;
            }
            // Try to find an existing conversation for this user by refreshing conversations
            try {
                const convResp = await axios.get('/conversations');
                const updatedConversations = convResp.data;
                setConversations(updatedConversations);

                const existing = updatedConversations.find((c: Conversation) => c.other_user.id === userId);
                    if (existing) {
                    // Load existing conversation messages
                    setShowUserList(false);
                    setSearchQuery(''); // Clear search
                    // Update URL
                    window.history.pushState({}, '', `/${userId}`);
                    loadMessages(existing.id, true);
                    return;
                }
            } catch (e) {
                // If fetching conversations fails, fallback to new chat behavior
                console.error('Error fetching conversations while preparing new chat', e);
            }

            // No existing conversation found — set up new chat window
            setNewChatReceiver(user);
            setSelectedConversation(null);
            setMessages([]);
            setShowUserList(false);
            setSearchQuery(''); // Clear search
            // Clear any pending popup state (we're actively viewing this user)
            pendingSeenIdsRef.current = [];
            setNewMessageCount(0);
            setShowNewMessagePopup(false);

            // Update URL
            window.history.pushState({}, '', `/${userId}`);
        } catch (error) {
            console.error('Error preparing new chat:', error);
        }
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        if (diffInHours < 24) {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
            });
        } else if (diffInHours < 48) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    };

    // Scroll to bottom on initial load after everything is rendered
    useEffect(() => {
        if (messages.length > 0 && messagesContainerRef.current) {
            // If a caller recorded that we were at bottom before messages were appended,
            // perform a scheduled scroll and clear the flag.
            if (wasAtBottomRef.current) {
                scheduleScrollToBottom();
                wasAtBottomRef.current = false;
                return;
            }

            const container = messagesContainerRef.current;
            const lastMessage = messages[messages.length - 1];
            if (!hasScrolledInitially.current) {
                // Initial load - multiple attempts to ensure we scroll after images load
                hasScrolledInitially.current = true;
                container.scrollTop = container.scrollHeight;
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 50);
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 200);
                setTimeout(() => {
                    container.scrollTop = container.scrollHeight;
                }, 500);
            } else if (!isSwitchingConversation.current && !isLoadingMoreMessages.current) {
                // After initial load - only auto-scroll if user is already at bottom or the last message is from the current user
                const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
                if (isAtBottom || lastMessage?.is_mine) {
                    setTimeout(() => {
                        container.scrollTop = container.scrollHeight;
                    }, 100);
                } else {
                    // User has scrolled up; do not auto-scroll. Leave pending messages popup management to the message handler.
                }
            }

            // If this was a hard refresh, mark any loaded unseen messages as seen immediately
            if (isHardRefreshRef.current) {
                const unseenIds = (messages || []).filter((m: any) => !m.is_mine && !m.is_read).map((m: any) => m.id);
                if (unseenIds.length > 0) {
                    (async () => {
                        try {
                            await Promise.all(unseenIds.map((id: number) => axios.post(`/messages/${id}/seen`).catch(() => {})));
                        } catch (e) {
                            // ignore
                        }
                        try { loadConversations(); } catch (e) { /* ignore */ }
                        isHardRefreshRef.current = false;
                    })();
                } else {
                    isHardRefreshRef.current = false;
                }
            }
        }
    }, [messages.length]);

    // Helper to mark pending messages as seen
    const markPendingAsSeen = async () => {
        const ids = pendingSeenIdsRef.current.splice(0);
        if (ids.length === 0) return;

        try {
            await Promise.all(ids.map(id => debugPostSeen(id, 'markPendingAsSeen')));
        } catch (e) {
            // ignore
        }

        setNewMessageCount(0);
        setShowNewMessagePopup(false);
        // Refresh conversations list so unread counts update
        try { loadConversations(); } catch (e) { /* ignore */ }
    };

    // Restore scroll position after loading more messages (pagination)
    useEffect(() => {
        if (isLoadingMoreMessages.current && window.__chatapp_scroll_restore && messagesContainerRef.current) {
            const { previousScrollTop, previousScrollHeight } = window.__chatapp_scroll_restore;
            const container = messagesContainerRef.current;
            setTimeout(() => {
                const newScrollHeight = container.scrollHeight;
                container.scrollTop = previousScrollTop + (newScrollHeight - previousScrollHeight);
                isLoadingMoreMessages.current = false;
                window.__chatapp_scroll_restore = null;
            }, 0);
        }
    }, [messages.length]);

    // Initial load
    useEffect(() => {
        // Only load conversations if not provided as initial props
        if (initialConversations.length === 0) {
            loadConversations();
        }
        loadUsers();

        // Detect if this navigation was a hard reload. In that case we will mark
        // any unseen messages as seen once the messages render (user performed a reload).
        try {
            const navEntries = (performance && (performance.getEntriesByType)) ? performance.getEntriesByType('navigation') : [];
            if (navEntries && navEntries.length > 0) {
                const nav = navEntries[0] as PerformanceNavigationTiming;
                isHardRefreshRef.current = (nav.type === 'reload');
            } else if ((performance as any).navigation) {
                // fallback for older browsers
                isHardRefreshRef.current = (performance as any).navigation.type === 1;
            }
        } catch (e) {
            // ignore
        }

    }, [initialConversations.length, loadConversations]);

    // Auto-select conversation when receiver_id is provided in URL
    useEffect(() => {
        // Skip if we already have initial messages (page refresh/SSR)
        if (initialMessages && initialMessages.length > 0) {
            return;
        }

        if (receiverIdFromUrl && !isLoading) {
            // Find conversation with this receiver
            const conversation = conversations.find(
                conv => conv.other_user.id === receiverIdFromUrl
            );

            if (conversation) {
                loadMessages(conversation.id);
            } else {
                // No conversation exists, prepare new chat window
                prepareNewChat(receiverIdFromUrl);
            }
            setReceiverIdFromUrl(undefined);
        }
    }, [receiverIdFromUrl, conversations, isLoading]);

    // Listen for new messages via WebSocket
    useEffect(() => {
        if (!auth.user) return;

        // Access Echo from window (configured in app.tsx)
        const Echo = (window as any).Echo;
        if (!Echo) {
            console.error('Echo is not initialized');
            return;
        }

        const channel = Echo.private(`user.${auth.user.id}`);

        channel.listen('.message.sent', (event: any) => {
            // Play notification sound for ALL received messages
            playNotificationSound();

            // If the message is for current conversation, add it
                if (selectedConversation && event.conversation_id === selectedConversation.id) {
                const newMessage: Message = {
                    id: event.id,
                    content: event.content,
                    sender: event.sender,
                    is_mine: false,
                    is_read: false,
                    created_at: event.created_at,
                    attachment_path: event.attachment_path,
                    attachment_type: event.attachment_type,
                    attachment_url: event.attachment_url,
                };

                // Determine if user is currently scrolled to bottom
                const container = messagesContainerRef.current;
                // Default to false when container isn't present to avoid accidental auto-seen
                const isAtBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight) < 100 : false;

                // Remember whether we were at bottom before DOM update
                try { wasAtBottomRef.current = isAtBottom; } catch (e) { wasAtBottomRef.current = false; }

                setMessages(prev => [...prev, newMessage]);

                // If message has attachment and user was at bottom, mark pending so we scroll after media loads
                if (newMessage.attachment_url && isAtBottom) {
                    pendingScrollIdsRef.current.push(newMessage.id);
                }

                if (isAtBottom) {
                    // If at bottom, auto-scroll and mark seen immediately
                    // final scroll will be driven by messages effect (safer), but trigger now as well
                    scheduleScrollToBottom();
                    try { debugPostSeen(event.id, 'incomingMessage_atBottom'); } catch (e) { /* ignore */ }
                } else {
                    // If user scrolled up, don't auto-scroll — show popup and queue for seen
                    pendingSeenIdsRef.current.push(event.id);
                    incNewMessageCount(1, 'incomingMessage_scrolledUp');
                    setShowNewMessagePopup(true);
                }
            } else if (newChatReceiver && event.sender.id === newChatReceiver.id) {
                const newMessage: Message = {
                    id: event.id,
                    content: event.content,
                    sender: event.sender,
                    is_mine: false,
                    is_read: false,
                    created_at: event.created_at,
                    attachment_path: event.attachment_path,
                    attachment_type: event.attachment_type,
                    attachment_url: event.attachment_url,
                };
                try { wasAtBottomRef.current = (messagesContainerRef.current ? (messagesContainerRef.current.scrollHeight - messagesContainerRef.current.scrollTop - messagesContainerRef.current.clientHeight) < 100 : false); } catch (e) { wasAtBottomRef.current = false; }
                setMessages(prev => [...prev, newMessage]);
                if (newMessage.attachment_url && wasAtBottomRef.current) {
                    pendingScrollIdsRef.current.push(newMessage.id);
                }

                // Mark as seen immediately if chat is open
                try {
                    debugPostSeen(event.id, 'incomingNewChat');
                } catch (error) {
                    console.error('Error marking message as seen:', error);
                }
            }

            // Refresh conversations list
            loadConversations();
        });

        // Listen for message seen events
        channel.listen('.message.seen', (event: any) => {
            // Update the message in the current conversation
            setMessages(prev => prev.map(msg =>
                msg.id === event.message_id
                    ? { ...msg, is_read: true }
                    : msg
            ));

            // Update conversations list to show blue tick on last message (only if this is the last message)
            setConversations(prevConversations => {
                const prev = Array.isArray(prevConversations) ? prevConversations : [];
                return prev.map(conv => {
                    // Check if this conversation's last message matches the seen message
                    if (conv.last_message &&
                        conv.id === event.conversation_id &&
                        conv.last_message.id === event.message_id) {
                        return {
                            ...conv,
                            last_message: {
                                ...conv.last_message,
                                is_read: true
                            },
                            unread_count: 0
                        };
                    }
                    return conv;
                });
            });
        });

        // Listen for message unsent events
        channel.listen('.message.unsent', (event: any) => {
            // Update the message to show as unsent
            setMessages(prev => prev.map(msg =>
                msg.id === event.message_id
                    ? { ...msg, content: null, attachment_path: null, attachment_type: null, attachment_url: null, unsent: true }
                    : msg
            ));

            // Refresh conversations to update last message
            loadConversations();
        });

        // Listen for message deleted events (updates conversation last message in real-time)
        channel.listen('.message.deleted', (event: any) => {
            setConversations(prevConversations => {
                // Ensure prevConversations is an array
                const prev = Array.isArray(prevConversations) ? prevConversations : [];
                // Copy array so we can mutate/sort locally
                let updated = [...prev];

                // If new_last_message is null, remove the conversation (all messages deleted)
                if (event.new_last_message === null) {
                    // If the deleted conversation was selected, clear the selection
                    if (selectedConversation?.id === event.conversation_id) {
                        setSelectedConversation(null);
                        setMessages([]);
                    }
                    updated = updated.filter(conv => conv.id !== event.conversation_id);

                    // No further sorting needed
                    return updated;
                }

                // Otherwise, update the last message for the matching conversation
                updated = updated.map(conv => {
                    if (conv.id === event.conversation_id) {
                        return {
                            ...conv,
                            last_message: event.new_last_message,
                            // keep/override updated_at so other parts that read it won't break
                            updated_at: event.new_last_message?.created_at ?? new Date().toISOString(),
                        };
                    }
                    return conv;
                });

                // Re-sort conversations so the list is ordered by the last message timestamp (newest first).
                updated.sort((a, b) => {
                    const aTime = a.last_message ? new Date(a.last_message.created_at).getTime() : 0;
                    const bTime = b.last_message ? new Date(b.last_message.created_at).getTime() : 0;
                    return bTime - aTime;
                });

                return updated;
            });
        });

        // Listen for conversation deleted events (removes conversation from list)
        channel.listen('.conversation.deleted', (event: any) => {
            setConversations(prevConversations => {
                const prev = Array.isArray(prevConversations) ? prevConversations : [];
                return prev.filter(conv => conv.id !== event.conversation_id);
            });

            // If the deleted conversation was selected, clear the selection
            if (selectedConversation?.id === event.conversation_id) {
                setSelectedConversation(null);
                setMessages([]);
                // Redirect to root so URL and UI reflect that conversation is closed
                // Also clear any pending new-message UI so it doesn't show across other conversations
                pendingSeenIdsRef.current = [];
                setNewMessageCount(0);
                setShowNewMessagePopup(false);
                router.get('/');
            }
        });

        return () => {
            channel.stopListening('.message.sent');
            channel.stopListening('.message.seen');
            channel.stopListening('.message.unsent');
            channel.stopListening('.message.deleted');
            channel.stopListening('.conversation.deleted');
        };
    }, [auth.user, selectedConversation, newChatReceiver, loadConversations, playNotificationSound]);



    return (
        <>
            <Head title="Chats - ChatApp" />
            <div className="flex h-screen bg-[#F0F2F5]">
                {/* Left Sidebar - Conversation List */}
                <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col">
                    {/* Header */}
                    <div className="bg-[#F0F2F5] px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-[#25D366] rounded-full flex items-center justify-center cursor-pointer">
                                <span className="text-white font-bold text-sm">
                                    {auth.user.name.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <span className="font-semibold text-gray-900">{auth.user.name}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setShowUserList(!showUserList)}
                                className="p-2 hover:bg-gray-200 rounded-full transition"
                                title="New Chat"
                            >
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                            <button onClick={handleLogout} className="p-2 hover:bg-gray-200 rounded-full transition">
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-3 py-2 bg-white">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search or start new chat"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-2 bg-[#F0F2F5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#25D366] text-sm"
                            />
                            <svg className="w-5 h-5 text-gray-500 absolute left-4 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {isSearching && (
                                <div className="absolute right-4 top-2.5">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#25D366]"></div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* User List Modal */}
                    {showUserList && (
                        <div className="bg-white border-b border-gray-200 max-h-60 overflow-y-auto">
                            <div className="px-4 py-2 bg-[#F0F2F5] font-semibold text-sm">Start New Chat</div>
                            {allUsers.map(user => (
                                <div
                                    key={user.id}
                                    onClick={() => prepareNewChat(user.id)}
                                    className="flex items-center px-4 py-3 hover:bg-[#F5F6F6] cursor-pointer"
                                >
                                    <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                                        <span className="text-white font-bold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="ml-3">
                                        <h3 className="font-semibold text-gray-900">{user.name}</h3>
                                        <p className="text-sm text-gray-600">{user.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Conversation List */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-32">
                                <div className="text-gray-500">Loading...</div>
                            </div>
                        ) : conversations.length === 0 && !searchQuery ? (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-500 px-4">
                                <p className="text-center">No conversations yet</p>
                                <p className="text-sm text-center mt-2">Click + to start a new chat</p>
                            </div>
                        ) : (
                            <>
                                {(() => {
                                    // Use search results if searching, otherwise show all conversations
                                    const filteredConversations = searchQuery
                                        ? searchResults.conversations
                                        : conversations;

                                    // Use search results for users if searching
                                    const filteredUsers = searchQuery
                                        ? searchResults.users
                                        : [];

                                    if (filteredConversations.length === 0 && filteredUsers.length === 0 && searchQuery) {
                                        return (
                                            <div className="flex flex-col items-center justify-center h-32 text-gray-500 px-4">
                                                <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                </svg>
                                                <p className="text-center">No results found</p>
                                                <p className="text-sm text-center mt-1">Try searching for a different name</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            {/* Existing conversations */}
                                            {filteredConversations.map((conv) => (
                                    <div
                                        key={conv.id}
                                        onClick={() => {
                                            // Update URL without full page reload
                                            window.history.pushState({}, '', `/${conv.other_user.id}`);

                                            // Immediately update unread count to 0 in local state
                                            setConversations(prevConvs =>
                                                prevConvs.map(c =>
                                                    c.id === conv.id ? { ...c, unread_count: 0 } : c
                                                )
                                            );

                                            // User explicitly clicked this conversation — mark loaded unseen messages as seen.
                                            loadMessages(conv.id, true);
                                        }}
                                        className={`flex items-center px-4 py-3 hover:bg-[#F5F6F6] cursor-pointer border-l-4 ${
                                            selectedConversation?.id === conv.id
                                                ? 'bg-[#F0F2F5] border-[#25D366]'
                                                : 'border-transparent'
                                        }`}
                                    >
                                        <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                                            <span className="text-white font-bold">
                                                {conv.other_user.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="ml-3 flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <h3 className="font-semibold text-gray-900 truncate">
                                                    {conv.other_user.name}
                                                </h3>
                                                {conv.last_message && (
                                                    <span className="text-xs text-gray-500">
                                                        {formatTime(conv.last_message.created_at)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <div className="flex items-center space-x-1 flex-1 min-w-0">
                                                    {conv.last_message?.is_mine && (
                                                        <svg
                                                            className={`w-4 h-4 flex-shrink-0 ${
                                                                conv.last_message.is_read ? 'text-[#53BDEB]' : 'text-gray-500'
                                                            }`}
                                                            fill="currentColor"
                                                            viewBox="0 0 16 15"
                                                        >
                                                            <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                                                        </svg>
                                                    )}
                                                    <p className="text-sm text-gray-600 truncate">
                                                        {conv.last_message?.content || 'No messages yet'}
                                                    </p>
                                                </div>
                                                {conv.unread_count > 0 && (
                                                    <span className="ml-2 bg-[#25D366] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                                                        {conv.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    ))}

                                    {/* Users not in conversations */}
                                    {searchQuery && filteredUsers.length > 0 && (
                                        <div className="px-4 py-2 bg-[#F0F2F5] font-semibold text-xs text-gray-600">
                                            New Contacts
                                        </div>
                                    )}
                                    {filteredUsers.map(user => (
                                        <div
                                            key={`user-${user.id}`}
                                            onClick={() => prepareNewChat(user.id)}
                                            className="flex items-center px-4 py-3 hover:bg-[#F5F6F6] cursor-pointer"
                                        >
                                            <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                                                <span className="text-white font-bold">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="ml-3">
                                                <h3 className="font-semibold text-gray-900">{user.name}</h3>
                                                <p className="text-sm text-gray-600">{user.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                        </>
                                    );
                                })()}
                            </>
                        )}
                    </div>
                </div>

                {/* Center - Chat Window */}
                <div className="flex-1 flex flex-col bg-[#EFEAE2]">
                    {isLoadingMessages && !selectedConversation && !newChatReceiver ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#25D366] mx-auto mb-4"></div>
                                <p className="text-gray-500">Loading conversation...</p>
                            </div>
                        </div>
                    ) : (selectedConversation || newChatReceiver || receiverIdFromUrl) ? (
                        <>
                            {/* Chat Header */}
                            <div className="bg-[#F0F2F5] px-4 py-3 flex items-center justify-between border-b border-gray-200">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">
                                            {(selectedConversation?.other_user.name || newChatReceiver?.name || '').charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900">
                                            {selectedConversation?.other_user.name || newChatReceiver?.name}
                                        </h3>
                                        <p className="text-xs text-gray-600">Click to view profile</p>
                                    </div>
                                </div>
                                {selectedConversation && (
                                    <button
                                        onClick={handleDeleteConversation}
                                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                                        title="Delete conversation"
                                    >
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Messages Area */}
                            <div
                                ref={messagesContainerRef}
                                onScroll={handleScroll}
                                className="flex-1 overflow-y-auto p-4 space-y-3"
                                style={{
                                    backgroundImage:
                                        "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%23d9d9d9\" fill-opacity=\"0.05\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')",
                                }}
                            >
                                {/* New message popup (visible when user is scrolled up and new messages arrive) */}
                                {showNewMessagePopup && newMessageCount > 0 && (
                                    <div className="fixed left-1/2 transform -translate-x-1/2 bottom-28 z-50">
                                        <button
                                            onClick={() => {
                                                scheduleScrollToBottom();
                                                markPendingAsSeen();
                                            }}
                                            className="bg-[#25D366] text-white px-4 py-2 rounded-full shadow-md hover:scale-105 transition-transform"
                                        >
                                            {newMessageCount} new message{newMessageCount > 1 ? 's' : ''} — scroll down
                                        </button>
                                    </div>
                                )}
                                {/* Loading indicator at top */}
                                {isLoadingMore && (
                                    <div className="flex justify-center py-2">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00A884]"></div>
                                    </div>
                                )}

                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'} group relative`}
                                    >
                                        {/* Message options dropdown */}
                                        <div className={`${msg.is_mine ? 'order-1 mr-2' : 'order-2 ml-2'} opacity-0 group-hover:opacity-100 transition-opacity`}>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setMessageMenuOpen(messageMenuOpen === msg.id ? null : msg.id)}
                                                    className="p-1 hover:bg-gray-200 rounded"
                                                >
                                                    <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                                    </svg>
                                                </button>
                                                {messageMenuOpen === msg.id && (
                                                    <div className={`absolute ${msg.is_mine ? 'right-0' : 'left-0'} mt-1 w-48 bg-white rounded-lg shadow-lg z-10 py-1`}>
                                                        {msg.is_mine && !msg.unsent && (
                                                            <button
                                                                onClick={() => handleUnsend(msg.id)}
                                                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                                                            >
                                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                                </svg>
                                                                Unsend
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteForMe(msg.id)}
                                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 flex items-center"
                                                        >
                                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                            Delete for me
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            className={`${msg.is_mine ? 'order-2' : 'order-1'} max-w-[65%] rounded-lg px-3 py-2 ${
                                                msg.is_mine ? 'bg-[#D9FDD3]' : 'bg-white'
                                            }`}
                                        >
                                            {/* Show unsent message indicator */}
                                            {msg.unsent ? (
                                                <p className="text-sm text-gray-500 italic">
                                                    {msg.is_mine ? 'You deleted this message' : 'This message was deleted'}
                                                </p>
                                            ) : (
                                                <>
                                                    {/* Attachment */}
                                                    {msg.attachment_url && msg.attachment_type === 'image' && (
                                                        <img
                                                            src={msg.attachment_url}
                                                            alt="Attachment"
                                                            className="rounded-lg mb-2 w-64 h-40 md:w-80 md:h-48 lg:w-96 lg:h-56 object-cover cursor-pointer hover:opacity-90"
                                                            onClick={() => window.open(msg.attachment_url!, '_blank')}
                                                            onLoad={() => {
                                                                const container = messagesContainerRef.current;
                                                                const isAtBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight) < 100 : false;
                                                                try { console.debug('[debug] image onLoad', { id: msg.id, pending: pendingScrollIdsRef.current.slice(), isAtBottom, scrollHeight: container?.scrollHeight }); } catch (e) {}
                                                                // If this message was marked as pending for scroll, trigger scroll now.
                                                                if (pendingScrollIdsRef.current.includes(msg.id)) {
                                                                    // remove id
                                                                    pendingScrollIdsRef.current = pendingScrollIdsRef.current.filter(id => id !== msg.id);
                                                                    scheduleScrollToBottom();
                                                                    return;
                                                                }
                                                                if (hasScrolledInitially.current && isAtBottom && container) {
                                                                    scheduleScrollToBottom();
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                    {msg.attachment_url && msg.attachment_type === 'video' && (
                                                        <video
                                                            src={msg.attachment_url}
                                                            controls
                                                            className="rounded-lg mb-2 w-64 h-40 md:w-80 md:h-48 lg:w-96 lg:h-56 object-cover"
                                                            onLoadedMetadata={() => {
                                                                const container = messagesContainerRef.current;
                                                                const isAtBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight) < 100 : false;
                                                                try { console.debug('[debug] video onLoadedMetadata', { id: msg.id, pending: pendingScrollIdsRef.current.slice(), isAtBottom, scrollHeight: container?.scrollHeight }); } catch (e) {}
                                                                if (pendingScrollIdsRef.current.includes(msg.id)) {
                                                                    pendingScrollIdsRef.current = pendingScrollIdsRef.current.filter(id => id !== msg.id);
                                                                    scheduleScrollToBottom();
                                                                    return;
                                                                }
                                                                if (hasScrolledInitially.current && isAtBottom && container) {
                                                                    scheduleScrollToBottom();
                                                                }
                                                            }}
                                                        />
                                                    )}

                                                    {msg.content && <p className="text-sm text-gray-900 break-words">{msg.content}</p>}
                                                </>
                                            )}
                                            <div className="flex items-center justify-end space-x-1 mt-1">
                                                <span className="text-[10px] text-gray-500">
                                                    {formatTime(msg.created_at)}
                                                </span>
                                                {msg.is_mine && (
                                                    <svg
                                                        className={`w-4 h-4 ${
                                                            msg.is_read ? 'text-[#53BDEB]' : 'text-gray-500'
                                                        }`}
                                                        fill="currentColor"
                                                        viewBox="0 0 16 15"
                                                    >
                                                        <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z" />
                                                    </svg>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />

                                {/* Scroll to Bottom Button */}
                                {showScrollButton && (
                                    <button
                                        onClick={() => scheduleScrollToBottom()}
                                        className="fixed bottom-24 right-8 bg-white hover:bg-gray-50 rounded-full p-3 shadow-lg transition-all z-10"
                                        title="Scroll to bottom"
                                    >
                                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Message Input */}
                            <div className="bg-[#F0F2F5] px-4 py-3 relative">
                                {/* Emoji Picker */}
                                {showEmojiPicker && (
                                    <div className="absolute bottom-16 left-4 z-50">
                                        <EmojiPicker onEmojiClick={handleEmojiClick} />
                                    </div>
                                )}

                                {/* File Preview */}
                                {filePreview && (
                                    <div className="mb-2 relative inline-block">
                                        <div className="relative bg-white p-2 rounded-lg shadow-md">
                                            {selectedFile?.type.startsWith('image/') ? (
                                                <img src={filePreview} alt="Preview" className="max-h-32 rounded" />
                                            ) : (
                                                <video src={filePreview} className="max-h-32 rounded" />
                                            )}
                                            <button
                                                onClick={clearFileSelection}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-end space-x-2">
                                    <button
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className="p-2 hover:bg-gray-200 rounded-full transition mb-1"
                                    >
                                        <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
                                        </svg>
                                    </button>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*,video/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="p-2 hover:bg-gray-200 rounded-full transition mb-1"
                                    >
                                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                    </button>

                                    <div className="flex-1 bg-white rounded-lg">
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Type a message"
                                        rows={1}
                                        className="w-full px-4 py-3 bg-transparent focus:outline-none resize-none text-sm"
                                        style={{ maxHeight: '100px' }}
                                        disabled={isSending}
                                    />
                                </div>
                                <button
                                    onClick={handleSendMessage}
                                    disabled={(!message.trim() && !selectedFile) || isSending}
                                    className="p-3 bg-[#25D366] hover:bg-[#20BD5A] rounded-full transition mb-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-32 h-32 bg-[#F0F2F5] rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.68-.33-3.83-.91l-.27-.17-2.83.48.48-2.83-.17-.27C4.83 14.68 4.5 13.38 4.5 12c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5-3.36 7.5-7.5 7.5zm4.5-6.5c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43s.17-.25.25-.41c.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.01 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18s-.22-.17-.47-.29z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-700 mb-2">Welcome to ChatApp</h3>
                                <p className="text-gray-500">Select a conversation to start messaging</p>
                                <p className="text-gray-500 mt-1">or click + to start a new chat</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
