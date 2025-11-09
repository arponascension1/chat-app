# Chat App Design Document (WhatsApp-like)

## 📋 Overview
A real-time chat application similar to WhatsApp, built with Laravel 12, Inertia.js, React, and TailwindCSS.

---

## 🎯 Core Features

### Phase 1: Essential Features
1. **User Authentication**
   - Registration with phone number/email
   - Login/Logout
   - Profile management (name, photo, status/bio)
   - Online/Offline status

2. **One-on-One Chat**
   - Real-time messaging
   - Message delivery status (sent, delivered, read)
   - Typing indicators
   - Message timestamps
   - Unread message counter

3. **Message Types**
   - Text messages
   - Emojis
   - File attachments (images, documents, videos)
   - Voice messages

4. **Contact Management**
   - Contact list
   - Search contacts
   - Add new contacts
   - Block/Unblock users

5. **Chat List**
   - Recent conversations
   - Last message preview
   - Unread badges
   - Pinned chats
   - Archive chats

### Phase 2: Advanced Features
1. **Group Chats**
   - Create groups
   - Add/remove members
   - Group admin privileges
   - Group info (name, photo, description)
   - Member list

2. **Media Gallery**
   - View all shared media
   - Filter by type (photos, videos, documents)

3. **Message Features**
   - Reply to specific messages
   - Forward messages
   - Delete messages (for me / for everyone)
   - Edit messages
   - Message reactions

4. **Notifications**
   - Push notifications
   - In-app notifications
   - Notification settings (mute chats, custom tones)

5. **Search Functionality**
   - Search messages within chat
   - Global search across all chats
   - Search by contact name

### Phase 3: Premium Features
1. **Voice/Video Calls**
   - One-on-one voice calls
   - One-on-one video calls
   - Group calls

2. **Stories/Status**
   - Post text/image/video status
   - View contacts' status
   - Status privacy settings
   - 24-hour auto-delete

3. **Encryption**
   - End-to-end encryption
   - Security indicators

---

## 🗄️ Database Schema Design

### 1. Users Table
```sql
users
- id (ULID primary key)
- name (string)
- email (string, unique, nullable)
- phone (string, unique, nullable)
- email_verified_at (timestamp, nullable)
- phone_verified_at (timestamp, nullable)
- password (string)
- profile_photo (string, nullable)
- bio (text, nullable, max 139 chars)
- last_seen_at (timestamp, nullable)
- is_online (boolean, default false)
- remember_token (string)
- timestamps
```

### 2. Contacts Table
```sql
contacts
- id (ULID primary key)
- user_id (foreign key → users)
- contact_user_id (foreign key → users)
- contact_name (string, nullable) // Custom name saved by user
- is_blocked (boolean, default false)
- blocked_at (timestamp, nullable)
- timestamps

// Unique constraint on (user_id, contact_user_id)
```

### 3. Conversations Table
```sql
conversations
- id (ULID primary key)
- type (enum: 'private', 'group')
- name (string, nullable) // For groups
- description (text, nullable) // For groups
- photo (string, nullable) // For groups
- created_by (foreign key → users, nullable)
- timestamps
```

### 4. Conversation Participants Table
```sql
conversation_participants
- id (ULID primary key)
- conversation_id (foreign key → conversations)
- user_id (foreign key → users)
- role (enum: 'admin', 'member', default 'member')
- joined_at (timestamp)
- left_at (timestamp, nullable)
- is_pinned (boolean, default false)
- is_archived (boolean, default false)
- is_muted (boolean, default false)
- last_read_at (timestamp, nullable)
- timestamps

// Unique constraint on (conversation_id, user_id) where left_at is null
```

### 5. Messages Table
```sql
messages
- id (ULID primary key)
- conversation_id (foreign key → conversations)
- sender_id (foreign key → users)
- parent_message_id (foreign key → messages, nullable) // For replies
- type (enum: 'text', 'image', 'video', 'audio', 'document', 'file')
- content (text, nullable) // For text messages
- file_path (string, nullable) // For media/files
- file_name (string, nullable)
- file_size (integer, nullable)
- file_mime_type (string, nullable)
- is_edited (boolean, default false)
- edited_at (timestamp, nullable)
- deleted_at (timestamp, nullable) // Soft delete
- timestamps
```

### 6. Message Statuses Table
```sql
message_statuses
- id (ULID primary key)
- message_id (foreign key → messages)
- user_id (foreign key → users)
- status (enum: 'sent', 'delivered', 'read')
- status_at (timestamp)
- timestamps

// Composite index on (message_id, user_id)
```

### 7. Message Reactions Table
```sql
message_reactions
- id (ULID primary key)
- message_id (foreign key → messages)
- user_id (foreign key → users)
- reaction (string) // emoji
- timestamps

// Unique constraint on (message_id, user_id)
```

### 8. Typing Indicators Table (In-Memory/Redis)
```
Structure in Redis:
typing:{conversation_id} → Set of user_ids with TTL of 3 seconds
```

---

## 🏗️ Backend Architecture (Laravel)

### Models
```
app/Models/
├── User.php
├── Contact.php
├── Conversation.php
├── ConversationParticipant.php
├── Message.php
├── MessageStatus.php
└── MessageReaction.php
```

### Controllers
```
app/Http/Controllers/
├── Auth/
│   ├── RegisterController.php
│   ├── LoginController.php
│   └── ProfileController.php
├── ContactController.php
├── ConversationController.php
├── MessageController.php
├── MediaController.php
└── SearchController.php
```

### Events & Listeners
```
app/Events/
├── MessageSent.php
├── MessageDelivered.php
├── MessageRead.php
├── UserTyping.php
├── UserOnline.php
└── UserOffline.php

app/Listeners/
├── BroadcastMessageSent.php
├── UpdateMessageStatus.php
└── UpdateUserActivity.php
```

### Broadcasting Channels
```
channels.php:
- private-conversation.{conversationId}
- private-user.{userId}
- presence-conversation.{conversationId}
```

### Jobs
```
app/Jobs/
├── SendMessageNotification.php
├── ProcessMediaUpload.php
├── DeleteOldMessages.php
└── UpdateUserLastSeen.php
```

### Middleware
```
app/Http/Middleware/
├── CheckConversationAccess.php
├── CheckMessageOwnership.php
└── TrackUserActivity.php
```

### Resources (API Transformers)
```
app/Http/Resources/
├── UserResource.php
├── ContactResource.php
├── ConversationResource.php
├── MessageResource.php
└── MessageStatusResource.php
```

---

## 🎨 Frontend Architecture (React + Inertia.js)

### Page Components
```
resources/js/pages/
├── Auth/
│   ├── Login.tsx
│   ├── Register.tsx
│   └── Profile.tsx
├── Chats/
│   ├── Index.tsx              // Main chat interface
│   ├── ChatList.tsx           // Left sidebar with conversation list
│   ├── ChatWindow.tsx         // Center: active conversation
│   └── ChatInfo.tsx           // Right sidebar: conversation info
├── Contacts/
│   ├── Index.tsx
│   └── Add.tsx
└── Settings/
    └── Index.tsx
```

### Component Structure
```
resources/js/components/
├── Layout/
│   ├── AppLayout.tsx
│   ├── AuthLayout.tsx
│   ├── Sidebar.tsx
│   └── TopBar.tsx
├── Chat/
│   ├── ConversationItem.tsx    // Single conversation in list
│   ├── MessageBubble.tsx       // Single message
│   ├── MessageInput.tsx        // Text input + attachments
│   ├── TypingIndicator.tsx
│   ├── MessageStatus.tsx       // Sent/Delivered/Read indicators
│   ├── MessageReaction.tsx
│   └── MediaPreview.tsx
├── Contact/
│   ├── ContactItem.tsx
│   ├── ContactList.tsx
│   └── ContactSearch.tsx
├── User/
│   ├── Avatar.tsx
│   ├── UserStatus.tsx          // Online/Offline indicator
│   └── ProfileCard.tsx
├── Media/
│   ├── ImageUpload.tsx
│   ├── FileUpload.tsx
│   ├── VoiceRecorder.tsx
│   └── MediaGallery.tsx
├── UI/
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   ├── Dropdown.tsx
│   ├── Badge.tsx
│   └── SearchBar.tsx
└── Shared/
    ├── LoadingSpinner.tsx
    ├── EmptyState.tsx
    └── ErrorBoundary.tsx
```

### State Management
```
resources/js/stores/
├── useAuthStore.ts           // User authentication state
├── useConversationStore.ts   // Active conversations
├── useMessageStore.ts        // Messages cache
├── useContactStore.ts        // Contacts list
└── useUIStore.ts            // UI state (modals, sidebars)
```

### Hooks
```
resources/js/hooks/
├── useWebSocket.ts          // Laravel Echo/Pusher connection
├── useTypingIndicator.ts    // Handle typing events
├── useMessageStatus.ts      // Track message delivery status
├── useInfiniteScroll.ts     // Load more messages
├── useMediaUpload.ts        // File upload handling
└── useOnlineStatus.ts       // User presence tracking
```

### Types
```
resources/js/types/
├── models.ts                // Model interfaces
├── api.ts                   // API response types
└── components.ts            // Component prop types
```

---

## 🔌 Real-Time Communication

### Technology Stack
- **Laravel Broadcasting** with Pusher or Laravel Reverb
- **Laravel Echo** on frontend
- **Redis** for pub/sub and caching

### Events to Broadcast
1. `MessageSent` - New message in conversation
2. `MessageDelivered` - Message delivered to recipient
3. `MessageRead` - Message read by recipient
4. `UserTyping` - User is typing
5. `UserStoppedTyping` - User stopped typing
6. `UserOnline` - User came online
7. `UserOffline` - User went offline
8. `ConversationUpdated` - Conversation metadata changed
9. `MessageDeleted` - Message was deleted
10. `MessageEdited` - Message was edited

### Channel Structure
```javascript
// Private channel for each conversation
Echo.private(`conversation.${conversationId}`)
    .listen('MessageSent', (e) => { /* ... */ })
    .listen('MessageDeleted', (e) => { /* ... */ })
    .listen('MessageEdited', (e) => { /* ... */ });

// Presence channel for online users in conversation
Echo.join(`conversation.${conversationId}`)
    .here((users) => { /* ... */ })
    .joining((user) => { /* ... */ })
    .leaving((user) => { /* ... */ })
    .listenForWhisper('typing', (e) => { /* ... */ });

// Private channel for each user
Echo.private(`user.${userId}`)
    .listen('MessageDelivered', (e) => { /* ... */ })
    .listen('NewConversation', (e) => { /* ... */ });
```

---

## 🎨 UI/UX Design Specifications

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│  Top Bar (App Name, Search, Settings)                       │
├─────────────┬───────────────────────────┬───────────────────┤
│             │                           │                   │
│  Chat List  │     Active Chat Window    │   Chat Info      │
│  (Sidebar)  │                           │   (Optional)     │
│             │  ┌────────────────────┐   │                   │
│  • Chat 1   │  │  Chat Header       │   │   Profile Photo  │
│  • Chat 2   │  └────────────────────┘   │   Name            │
│  • Chat 3   │                           │   Bio             │
│  • Chat 4   │  ┌────────────────────┐   │                   │
│             │  │  Messages          │   │   Media Gallery  │
│             │  │  ↓                 │   │   Shared Files   │
│             │  │  [Message 1]       │   │                   │
│             │  │  [Message 2]       │   │   Members List   │
│             │  │  [Message 3]       │   │   (for groups)   │
│             │  └────────────────────┘   │                   │
│             │                           │   Actions        │
│             │  ┌────────────────────┐   │   • Mute         │
│             │  │  Message Input     │   │   • Archive      │
│             │  └────────────────────┘   │   • Block        │
└─────────────┴───────────────────────────┴───────────────────┘
```

### Color Scheme (WhatsApp-inspired)
```css
Primary Colors:
- Brand Green: #25D366
- Dark Green: #075E54
- Teal: #128C7E

Background Colors:
- Chat Background: #E5DDD5 (with subtle pattern)
- Sidebar Background: #FFFFFF
- Message Bubble (Sent): #DCF8C6
- Message Bubble (Received): #FFFFFF

Text Colors:
- Primary Text: #000000
- Secondary Text: #667781
- Timestamp: #667781
- Link: #027EB5

Status Colors:
- Online: #25D366
- Typing: #25D366
- Sent (✓): #667781
- Delivered (✓✓): #667781
- Read (✓✓): #53BDEB
```

### Typography
```css
Font Family: 
- Primary: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif

Font Sizes:
- Chat Title: 16px (font-weight: 600)
- Message Text: 14px
- Timestamp: 11px
- Username: 13px (font-weight: 600)
- Status Text: 12px
```

### Component Specifications

#### Message Bubble
- Max width: 65% of chat window
- Padding: 6px 7px 8px 9px
- Border radius: 7.5px
- Sent messages: align right, green background
- Received messages: align left, white background
- Tail on first message in group
- Timestamp + status in bottom right

#### Chat List Item
- Height: 72px
- Avatar: 49px diameter circle
- Unread badge: circular, green background
- Last message preview: truncate to 2 lines
- Timestamp: top right corner

#### Message Input
- Height: auto (min 42px, max 200px)
- Border radius: 21px
- Buttons: emoji, attach, voice record
- Send button: appears when text is entered

---

## 🔐 Security Considerations

1. **Authentication**
   - Laravel Sanctum for API authentication
   - Rate limiting on login attempts
   - Password strength requirements
   - Optional 2FA

2. **Authorization**
   - Verify user is participant before showing messages
   - Check permissions for group admin actions
   - Validate file uploads (type, size, content)

3. **Data Protection**
   - HTTPS only
   - Sanitize all user inputs
   - XSS protection
   - CSRF protection
   - Prepared statements for SQL (Eloquent ORM)

4. **File Security**
   - Store uploaded files outside public directory
   - Generate unique filenames
   - Validate file types and sizes
   - Scan for malware (optional)
   - Set proper file permissions

5. **Privacy**
   - Soft delete messages
   - Hide blocked users
   - Last seen privacy settings
   - Profile photo privacy settings

---

## 🚀 Performance Optimization

1. **Database**
   - Index on frequently queried columns
   - Optimize queries with eager loading
   - Use database transactions
   - Implement query caching

2. **Caching Strategy**
   - Cache conversation lists
   - Cache user online status (Redis)
   - Cache contact lists
   - Cache recent messages

3. **Frontend**
   - Virtual scrolling for long message lists
   - Lazy load images
   - Debounce search inputs
   - Optimize re-renders with React.memo
   - Code splitting for routes

4. **Media**
   - Generate thumbnails for images/videos
   - Compress images on upload
   - Use CDN for media delivery
   - Lazy load media in conversations

5. **Real-time**
   - Use presence channels efficiently
   - Throttle typing indicators
   - Queue long-running jobs
   - Use Redis for temporary data

---

## 📱 Responsive Design

### Breakpoints
```css
Mobile: < 768px
Tablet: 768px - 1024px
Desktop: > 1024px
```

### Mobile Layout
- Single column view
- Show either chat list OR active chat
- Bottom navigation bar
- Floating action button for new chat
- Swipe gestures for actions

### Tablet Layout
- Two column: chat list + active chat
- Hide chat info sidebar by default
- Slide-over for chat info

### Desktop Layout
- Three column: chat list + active chat + chat info
- All features visible
- Keyboard shortcuts support

---

## 🧪 Testing Strategy

### Backend Tests
```
tests/Feature/
├── Auth/
│   ├── LoginTest.php
│   └── RegistrationTest.php
├── Chat/
│   ├── SendMessageTest.php
│   ├── DeleteMessageTest.php
│   └── EditMessageTest.php
├── Contact/
│   ├── AddContactTest.php
│   └── BlockContactTest.php
└── Conversation/
    ├── CreateConversationTest.php
    └── LeaveConversationTest.php

tests/Unit/
├── MessageTest.php
├── ConversationTest.php
└── UserTest.php
```

### Frontend Tests
```javascript
// Using React Testing Library + Vitest
- Unit tests for components
- Integration tests for features
- E2E tests with Playwright
```

---

## 📦 Dependencies

### Backend (Laravel)
```json
{
  "pusher/pusher-php-server": "^7.2",
  "intervention/image": "^3.0",
  "spatie/laravel-medialibrary": "^11.0",
  "laravel/sanctum": "^4.0"
}
```

### Frontend (React)
```json
{
  "@tanstack/react-query": "^5.0",
  "zustand": "^5.0",
  "laravel-echo": "^1.16",
  "pusher-js": "^8.4",
  "emoji-picker-react": "^4.0",
  "react-dropzone": "^14.0",
  "date-fns": "^4.0",
  "react-virtuoso": "^4.0",
  "lucide-react": "^0.400"
}
```

---

## 🗓️ Implementation Roadmap

### Week 1-2: Foundation
- [ ] Database schema setup and migrations
- [ ] User authentication system
- [ ] Basic models and relationships
- [ ] API routes structure

### Week 3-4: Core Chat Functionality
- [ ] One-on-one chat creation
- [ ] Send/receive text messages
- [ ] Real-time broadcasting setup
- [ ] Message delivery status
- [ ] Basic frontend UI layout

### Week 5-6: Enhanced Features
- [ ] File upload and media messages
- [ ] Contact management
- [ ] Chat list with search
- [ ] Typing indicators
- [ ] Online/offline status

### Week 7-8: Advanced Features
- [ ] Group chats
- [ ] Message reactions
- [ ] Reply to messages
- [ ] Edit/delete messages
- [ ] Unread message counters

### Week 9-10: Polish & Optimization
- [ ] Notifications system
- [ ] Performance optimization
- [ ] Responsive design refinement
- [ ] Testing and bug fixes

### Week 11-12: Additional Features
- [ ] Archive/pin chats
- [ ] Media gallery
- [ ] Advanced search
- [ ] User settings and preferences

---

## 🔄 API Endpoints

### Authentication
```
POST   /api/register
POST   /api/login
POST   /api/logout
GET    /api/user
PUT    /api/profile
```

### Contacts
```
GET    /api/contacts
POST   /api/contacts
DELETE /api/contacts/{id}
POST   /api/contacts/{id}/block
POST   /api/contacts/{id}/unblock
```

### Conversations
```
GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/{id}
PUT    /api/conversations/{id}
DELETE /api/conversations/{id}
POST   /api/conversations/{id}/participants
DELETE /api/conversations/{id}/participants/{userId}
POST   /api/conversations/{id}/pin
POST   /api/conversations/{id}/archive
POST   /api/conversations/{id}/mute
```

### Messages
```
GET    /api/conversations/{id}/messages
POST   /api/conversations/{id}/messages
PUT    /api/messages/{id}
DELETE /api/messages/{id}
POST   /api/messages/{id}/reactions
POST   /api/messages/{id}/forward
POST   /api/messages/{id}/read
```

### Media
```
POST   /api/media/upload
GET    /api/media/{id}
GET    /api/conversations/{id}/media
```

### Search
```
GET    /api/search/contacts?q={query}
GET    /api/search/messages?q={query}
GET    /api/search/conversations/{id}/messages?q={query}
```

---

## 📝 Notes

### Future Enhancements
- Voice/video calling (WebRTC)
- Stories/Status feature
- End-to-end encryption
- Dark mode theme
- Multi-device sync
- Backup and restore
- Stickers and GIFs
- Bot integration
- Desktop app (Electron)

### Technical Considerations
- Consider using Laravel Reverb instead of Pusher for cost savings
- Implement message pagination carefully for performance
- Use queues for sending notifications
- Consider implementing read receipts as opt-in feature
- Plan for horizontal scaling with Redis cluster
- Implement proper error handling and retry logic
- Add comprehensive logging for debugging

---

## 🎯 Success Metrics
- Message delivery time < 1 second
- App load time < 2 seconds
- Support for 1000+ concurrent users
- 99.9% uptime
- Real-time updates < 500ms latency

