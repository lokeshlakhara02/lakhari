# ChatRoulette Application

## Overview

ChatRoulette is a real-time random chat application that connects strangers for text and video conversations. Built with a modern web stack, it features interest-based matching, WebRTC video capabilities, and WebSocket-powered real-time communication. The application supports both text-only and video chat modes, allowing users to be matched with others who share similar interests.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React with TypeScript for type-safe component development
- Vite as the build tool and development server, providing fast HMR and optimized builds
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching

**UI Component Strategy**
- shadcn/ui component library (Radix UI primitives) for accessible, customizable components
- Tailwind CSS with CSS variables for theming and responsive design
- Dark/light theme support with custom theme provider
- Component organization: reusable UI components in `client/src/components/ui/`

**State Management**
- React hooks for local component state
- Custom hooks for WebSocket (`use-websocket.tsx`) and WebRTC (`use-webrtc.tsx`) functionality
- TanStack Query for API data fetching and caching
- LocalStorage for persisting user interests and theme preferences

### Backend Architecture

**Server Framework**
- Express.js server with TypeScript
- HTTP server upgraded with WebSocket support (ws library)
- Vite middleware integration for development mode with HMR
- Static file serving for production builds

**Real-Time Communication**
- WebSocket server for chat signaling, match-making, and message delivery
- Custom WebSocket message protocol with typed messages
- In-memory storage for active sessions and online users during development

**API Design**
- RESTful endpoints for statistics (`/api/stats`)
- WebSocket-based messaging for real-time features (user joins, match finding, message sending)
- Separation of HTTP and WebSocket concerns

### Data Storage Solutions

**Database Architecture**
- Drizzle ORM configured for PostgreSQL
- Schema defines three core tables: `chat_sessions`, `messages`, and `online_users`
- Zod schemas generated from Drizzle for runtime validation

**Storage Abstraction**
- `IStorage` interface defines storage contract
- `MemStorage` class provides in-memory implementation for development/testing
- Design allows for easy database integration without changing application logic
- Storage handles chat sessions, messages, and online user tracking

**Schema Design**
- Chat sessions track user pairs, chat type (text/video), interests, and status
- Messages store session-linked chat content with timestamps
- Online users maintain socket connections, interests, and waiting status

### Authentication and Authorization

**Current Implementation**
- No authentication system currently implemented
- Users identified by randomly generated UUIDs via WebSocket connections
- Anonymous chat model - no user accounts or persistent identity

**Design Considerations**
- Architecture supports future authentication integration
- User IDs are abstracted and could be replaced with authenticated user identifiers
- Session management would need to be added for persistent user accounts

## External Dependencies

### Third-Party Services

**WebRTC Infrastructure**
- Google STUN servers for NAT traversal (`stun.l.google.com:19302`, `stun1.l.google.com:19302`)
- Browser WebRTC APIs for peer-to-peer video/audio streaming
- No TURN server currently configured (would be needed for users behind restrictive firewalls)

**Database**
- Neon Database serverless PostgreSQL (configured via `@neondatabase/serverless`)
- Connection via `DATABASE_URL` environment variable
- Drizzle Kit for schema management and migrations

### UI Component Libraries

**Radix UI Primitives**
- Comprehensive set of unstyled, accessible components
- Includes: Dialog, Dropdown, Popover, Tooltip, Toast, Select, Checkbox, and more
- Provides keyboard navigation and ARIA compliance out of the box

**Supporting Libraries**
- `class-variance-authority` for component variant management
- `cmdk` for command menu functionality
- `embla-carousel-react` for carousel components
- `lucide-react` for icon system
- `react-day-picker` for date selection
- `vaul` for drawer components

### Development Tools

**Replit Integration**
- `@replit/vite-plugin-runtime-error-modal` for error overlays
- `@replit/vite-plugin-cartographer` for code mapping
- `@replit/vite-plugin-dev-banner` for development banners
- Automatic WebSocket protocol selection based on environment

### Build & Development

**Core Tools**
- TypeScript compiler with strict mode enabled
- ESBuild for server-side bundling
- PostCSS with Tailwind CSS and Autoprefixer
- Path aliases configured for clean imports (`@/`, `@shared/`, `@assets/`)

**Database Tooling**
- Drizzle Kit for schema migrations and push operations
- PostgreSQL dialect configured with connection pooling support