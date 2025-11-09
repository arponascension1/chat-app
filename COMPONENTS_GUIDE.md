# Chat Interface - Component Breakdown

## Component Structure

```
Chats/Index.tsx (Main Container)
├── Left Sidebar (400px width)
│   ├── Header Section
│   │   ├── User Avatar (Green circle with initials)
│   │   ├── User Name
│   │   └── Action Buttons (Info, Logout)
│   │
│   ├── Search Bar
│   │   └── Input with search icon
│   │
│   └── Conversation List (Scrollable)
│       └── ConversationItem (each)
│           ├── Avatar with online indicator
│           ├── Name + Timestamp
│           ├── Last Message Preview
│           └── Unread Badge (if any)
│
└── Chat Window (Flex-1)
    ├── Chat Header
    │   ├── Contact Avatar + Name
    │   ├── Online Status
    │   └── Action Buttons (Search, Menu)
    │
    ├── Messages Area (Scrollable, patterned background)
    │   └── MessageBubble (each)
    │       ├── Message Content
    │       ├── Timestamp
    │       └── Read Receipt (for sent messages)
    │
    └── Message Input Area
        ├── Emoji Button
        ├── Attach Button
        ├── Text Input (expandable)
        └── Send Button (Green circle)
```

## CSS Classes Used

### Layout Classes
- `flex`, `flex-col`, `flex-1` - Flexbox layout
- `w-[400px]` - Fixed width sidebar
- `h-screen` - Full screen height
- `overflow-y-auto` - Scrollable areas

### Background Classes
- `bg-[#F0F2F5]` - Light gray (sidebar header, main bg)
- `bg-white` - White (sidebar, received messages)
- `bg-[#EFEAE2]` - Beige (chat background)
- `bg-[#D9FDD3]` - Light green (sent messages)
- `bg-[#25D366]` - WhatsApp green (badges, buttons)

### Interactive Classes
- `hover:bg-gray-200` - Hover effects
- `cursor-pointer` - Clickable elements
- `transition` - Smooth transitions
- `focus:outline-none` - Clean focus states
- `focus:ring-2 focus:ring-[#25D366]` - Green focus ring

### Spacing Classes
- `px-4 py-3` - Consistent padding
- `space-x-3`, `space-y-3` - Gap between elements
- `mb-4`, `mt-6` - Margins

### Text Classes
- `text-sm`, `text-xs` - Font sizes
- `font-semibold`, `font-bold` - Font weights
- `text-gray-900`, `text-gray-600` - Text colors
- `truncate` - Text overflow handling

## Key Features Demonstrated

### 1. Conversation Item
```tsx
<div className="flex items-center px-4 py-3 hover:bg-[#F5F6F6] cursor-pointer">
  {/* Avatar with online indicator */}
  {/* Name, timestamp, last message */}
  {/* Unread badge */}
</div>
```

### 2. Message Bubble
```tsx
<div className={`
  max-w-[65%] rounded-lg px-3 py-2
  ${isMine ? 'bg-[#D9FDD3]' : 'bg-white'}
`}>
  <p>{content}</p>
  <div>{timestamp} {readReceipt}</div>
</div>
```

### 3. Message Input
```tsx
<div className="bg-[#F0F2F5] px-4 py-3 flex items-end space-x-2">
  <button>😊</button>
  <button>📎</button>
  <textarea />
  <button className="bg-[#25D366]">➤</button>
</div>
```

## Mock Data Structure

### Conversations Array
```javascript
[
  {
    id: 1,
    name: 'John Doe',
    lastMessage: 'Hey! How are you doing?',
    timestamp: '2:30 PM',
    unread: 3,
    online: true,
    avatar: 'JD'
  },
  // ... more conversations
]
```

### Messages Array
```javascript
[
  {
    id: 1,
    sender: 'John Doe',
    content: 'Hey! How are you doing?',
    timestamp: '2:25 PM',
    isMine: false,
    status: 'read'
  },
  // ... more messages
]
```

## State Management

```typescript
const [selectedChat, setSelectedChat] = useState(mockConversations[0]);
const [message, setMessage] = useState('');
const [searchQuery, setSearchQuery] = useState('');
```

## Event Handlers

```typescript
// Switch active conversation
onClick={() => setSelectedChat(conv)}

// Send message
const handleSendMessage = () => {
  if (message.trim()) {
    console.log('Sending message:', message);
    setMessage('');
  }
}

// Enter to send
onKeyPress={(e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}}

// Logout
const handleLogout = () => {
  router.post('/logout');
}
```

## Visual Indicators

### Online Status
```tsx
{online && (
  <div className="absolute bottom-0 right-0 
                  w-3 h-3 bg-[#25D366] 
                  border-2 border-white rounded-full" />
)}
```

### Unread Badge
```tsx
{unread > 0 && (
  <span className="bg-[#25D366] text-white 
                   text-xs rounded-full 
                   w-5 h-5 flex items-center justify-center">
    {unread}
  </span>
)}
```

### Read Receipts
```tsx
{isMine && (
  <svg className={`w-4 h-4 ${
    status === 'read' ? 'text-[#53BDEB]' : 'text-gray-500'
  }`}>
    {/* Double checkmark */}
  </svg>
)}
```

### Active Conversation
```tsx
className={`border-l-4 ${
  selectedChat.id === conv.id
    ? 'bg-[#F0F2F5] border-[#25D366]'
    : 'border-transparent'
}`}
```

## Background Pattern

The chat area uses an SVG pattern for the WhatsApp-style background:

```tsx
style={{ 
  backgroundImage: "url('data:image/svg+xml,...')" 
}}
```

This creates subtle dots in the background similar to WhatsApp.

## Responsive Considerations

- Sidebar: Fixed `400px` width on desktop
- Chat window: Takes remaining space with `flex-1`
- Message bubbles: Max width `65%` of container
- Search input: Full width with proper padding
- All touch targets: Minimum 44x44px for mobile

## Color Palette Reference

| Element | Color Code | Usage |
|---------|-----------|-------|
| Primary Green | #25D366 | Buttons, badges, borders |
| Dark Green | #075E54 | Future dark theme |
| Teal | #128C7E | Accents |
| Light Gray | #F0F2F5 | Headers, input backgrounds |
| Chat BG | #EFEAE2 | Message area background |
| Sent Bubble | #D9FDD3 | Your messages |
| Received Bubble | #FFFFFF | Others' messages |
| Read Receipt | #53BDEB | Blue checkmarks |
| Text Dark | #1F2937 | Primary text |
| Text Light | #6B7280 | Secondary text |

## Icons Used

All icons are inline SVG for performance:
- 💬 WhatsApp logo (chat icon)
- 🔍 Search icon
- ℹ️ Info icon
- 🚪 Logout icon
- 😊 Emoji icon
- 📎 Attachment icon
- ➤ Send icon
- ⋮ Menu icon (three dots)
- ✓✓ Read receipt (double check)

## Accessibility Features

- Proper semantic HTML
- Keyboard navigation support (Enter to send)
- Focus states on interactive elements
- Sufficient color contrast
- Descriptive SVG paths
- Touch-friendly target sizes
