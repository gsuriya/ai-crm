# AI CRM - Features Overview

## 🎯 Overview

This is an **AI-powered CRM for private markets investors** built with Next.js 14, TypeScript, Supabase, and Google APIs. The system helps investors manage companies, automate outreach workflows (cadences), and gain AI-powered insights.

---

## 🌟 Core Features

### 1. **Company Management**
- **Company Database**: Track companies with metadata (name, email, phone, industry, funding, etc.)
- **Company Detail Pages**: Comprehensive view of each company with:
  - Activity feed
  - AI insights panel
  - Financial charts
  - Meeting cards
  - Email threads
  - Notes editor
  - Document library
  - Coverage table
  - Org graph
  - Timeline snapshot
  - Similar companies (AI-powered)
  - Risk flags
  - Anomaly checks
  - Thesis fit analysis
  - Next best actions

### 2. **Semantic Search**
- **Natural Language Search**: Search companies using natural language queries
- **AI Query Extraction**: Converts natural language to structured search terms
- **Semantic Matching**: Uses pgvector embeddings for intelligent matching
- **Agent Mode**: AI-powered search assistant that can answer questions about companies

### 3. **AI Insights**
- **Company Insights**: AI-generated insights about companies
- **Anomaly Detection**: Identifies unusual patterns in company data
- **Coverage Gaps**: Finds missing information or opportunities
- **Ghosting Risk**: Predicts likelihood of companies going silent
- **Thesis Fit**: Analyzes how well companies match investment thesis
- **Lookalikes**: Finds similar companies using AI
- **Next Actions**: Suggests optimal next steps

### 4. **Email Integration**
- **Gmail API Integration**: Send emails directly via Gmail
- **Email Threading**: Properly thread replies in Gmail conversations
- **Email Logging**: Track all sent emails in `email_logs` table
- **Email Templates**: Configure email content in cadence blocks

### 5. **Calendar Integration**
- **Google Calendar API**: Create and send calendar invites
- **Smart Scheduling**: 
  - Business hours constraints (9am-5pm)
  - Availability checking
  - Custom duration settings
- **Event Logging**: Track all calendar invites sent

### 6. **Voice Calls (VAPI)**
- **AI Voice Calls**: Make automated voice calls via VAPI
- **Custom Prompts**: Configure AI agent behavior
- **Voicemail Fallback**: Automatically leave voicemail if call isn't answered
- **Call Logging**: Track all calls in `call_logs` table

---

## 🎯 **CADENCES** (Main Feature)

### What Are Cadences?

**Cadences are automated workflow sequences** that execute a series of actions (emails, calls, calendar invites, delays, conditions) for companies. Think of them as visual flowcharts where you drag-and-drop blocks to create sophisticated outreach sequences.

### Key Features

#### 1. **Visual Flow Builder**
- **Drag-and-Drop Interface**: Visual canvas for building workflows
- **Block Types**:
  - **Trigger**: Starting point (cadence starts)
  - **Email**: Send email to company
  - **Voice Call**: Make AI voice call via VAPI
  - **Calendar**: Send calendar invite
  - **Conditional**: If/Else logic (e.g., "if email opened", "if email replied")
  - **Delay**: Wait for specified time (seconds, minutes, hours, days)
  - **End**: Stop cadence execution
- **Connections**: Link blocks together to create flow
- **Zoom & Pan**: Navigate large workflows easily
- **Auto-save**: Changes saved to Supabase automatically

#### 2. **Block Configuration**

**Email Blocks:**
- Subject and body templates
- Thread selection:
  - **New thread**: Start new email conversation
  - **Reply to previous**: Automatically reply to most recent email in cadence
  - **Reply to specific block**: Reply to a specific email block by ID
- Subject locking: Automatically matches original subject for proper threading

**Voice Call Blocks:**
- Custom system prompt (AI agent behavior)
- Voicemail fallback toggle
- Custom voicemail message

**Calendar Blocks:**
- Event title and description
- Duration (minutes)
- Time constraints:
  - None (any time)
  - Business hours (9am-5pm weekdays)
- Availability checking toggle

**Conditional Blocks:**
- Condition types:
  - `email_opened`: Email was opened
  - `email_not_opened`: Email was not opened
  - `email_replied`: Email was replied to
  - `email_not_replied`: Email was not replied to
  - `email_opened_within_days`: Email opened within N days
  - `email_replied_within_days`: Email replied within N days
- True/False paths: Branch workflow based on condition result

**Delay Blocks:**
- Granular timing: seconds, minutes, hours, days
- Used for spacing between actions (e.g., wait 3 days before follow-up)

#### 3. **Cadence Execution**

**Execution Model:**
- **Company-Cadence Association**: Link companies to cadences via `company_cadences` table
- **Execution Tracking**: Each execution tracked in `cadence_executions` table
- **State Management**: 
  - Current block ID
  - Status (active, paused, completed, error)
  - Scheduled times (for delays)
  - Metadata (thread info, execution order, etc.)

**Execution Flow:**
1. User clicks "Start Cadence" for a company
2. System creates `company_cadence` entry
3. Creates `cadence_execution` entry with trigger block
4. Executes blocks sequentially:
   - **Email blocks**: Send email via Gmail API, store thread info
   - **Voice call blocks**: Initiate call via VAPI
   - **Calendar blocks**: Create calendar invite via Google Calendar API
   - **Conditional blocks**: Evaluate condition, branch to true/false path
   - **Delay blocks**: Schedule next block for future execution
   - **End blocks**: Mark cadence as completed

**Thread Management:**
- **ThreadInfoMap**: Tracks email thread IDs for each email block
- **Execution Order Tracking**: Records which blocks executed in current run
- **Stale Entry Prevention**: Filters out thread info from previous executions
- **Proper Threading**: Uses Gmail's thread ID and Message-ID for replies

**Delay Handling:**
- Delays are scheduled in database (`scheduled_for` timestamp)
- Background processor picks up scheduled executions
- Metadata (thread info) preserved across delays
- Execution continues after delay completes

#### 4. **Cadence Management**

**CRUD Operations:**
- **Create**: Build new cadence in visual flow builder
- **Read**: View all cadences in `/cadences` page
- **Update**: Edit existing cadence (modify blocks, connections, config)
- **Delete**: Remove cadence (with confirmation)

**Cadence Sharing:**
- All cadences are **company-wide** (shared across all users)
- No user ownership - any user can edit any cadence
- Stored in `cadences` table with `nodes` (JSONB) containing block definitions

**Cadence States:**
- **Draft**: Being edited (not yet saved)
- **Active**: Running for one or more companies
- **Paused**: Temporarily stopped
- **Completed**: Finished execution for a company

#### 5. **Agentic Builder (AI Assistant)**

**Chat Interface:**
- Right sidebar in flow builder
- Ask questions about your workflow
- Get suggestions for improvements
- AI-powered workflow analysis

**Example Queries:**
- "Add a follow-up email after 3 days if no reply"
- "What blocks should I use for a cold outreach sequence?"
- "How do I make this cadence reply to the same thread?"

#### 6. **API Endpoints**

**Cadence Management:**
- `PUT /api/cadence/start`: Start cadence for a company
- `POST /api/cadence/execute`: Execute next block in workflow
- `POST /api/cadence/process`: Process scheduled executions (background job)
- `GET /api/cadence/execution-status`: Get execution status
- `POST /api/cadence/condition`: Evaluate conditional block
- `POST /api/cadence-chat`: AI chat for workflow builder

---

## 📊 Database Schema

### Core Tables

**`companies`**
- Company information (name, email, phone, industry, funding, etc.)
- Semantic search embeddings

**`cadences`**
- Cadence definitions
- `nodes`: JSONB array of FlowBlock definitions
- Shared company-wide

**`company_cadences`**
- Association between companies and cadences
- Tracks status (active, paused, completed)
- `current_node_id`: Current position in workflow

**`cadence_executions`**
- Active workflow executions
- `current_block_id`: Current block being executed
- `status`: active, paused, completed, error
- `scheduled_for`: When to resume (for delays)
- `metadata`: Thread info, execution order, etc.

**`email_logs`**
- All sent emails
- Thread IDs, message IDs
- Subject, body, timestamps

**`call_logs`**
- All voice calls
- VAPI call IDs
- Phone numbers, status

**`company_content`**
- Activity feed entries
- Outreach logs
- Notes, documents

---

## 🔧 Technical Architecture

### Frontend
- **Next.js 14** (App Router)
- **React** with TypeScript
- **Framer Motion** for animations
- **Tailwind CSS** + **shadcn/ui** components
- **Client-side cadence builder** with visual canvas

### Backend
- **Next.js API Routes** (serverless functions)
- **Supabase** (PostgreSQL + pgvector)
- **Google APIs** (Gmail, Calendar)
- **VAPI SDK** (voice calls)
- **OpenAI** (AI insights, chat)

### Key Services
- `lib/services/gmail-direct.ts`: Email sending via Gmail API
- `lib/services/calendar.ts`: Calendar invite creation
- `lib/services/vapi.ts`: Voice call initiation
- `lib/services/cadence-execution.ts`: Workflow execution engine
- `lib/semantic-search.ts`: Semantic search functionality

---

## 🚀 Workflow Example

### Cold Outreach Cadence

1. **Trigger** → Start cadence
2. **Email Block 1** → Initial cold email
   - Subject: "Quick question about [Company Name]"
   - Body: Introduction and value proposition
3. **Delay Block** → Wait 3 days
4. **Conditional Block** → Check if email replied
   - **True Path** → **End Block** (they replied, stop)
   - **False Path** → Continue to step 5
5. **Email Block 2** → Follow-up email
   - Reply to previous thread
   - Subject automatically matches original
6. **Delay Block** → Wait 2 days
7. **Voice Call Block** → AI voice call
   - Custom prompt: "Schedule a meeting about partnership"
   - Voicemail fallback enabled
8. **Delay Block** → Wait 1 day
9. **Calendar Block** → Send calendar invite
   - Business hours only
   - Check availability
10. **End Block** → Cadence complete

---

## 🎨 UI Components

### Main Pages
- **`/companies`**: Company list with semantic search
- **`/companies/[id]`**: Company detail page
- **`/cadences`**: Cadence management page
- **`/insights`**: AI insights dashboard
- **`/pipeline`**: Pipeline management
- **`/tasks`**: Task management

### Key Components
- `CadenceFlowBuilder`: Visual workflow builder
- `AIInsightsPanel`: AI-powered insights
- `CompanyTabs`: Company detail navigation
- `ActivityFeed`: Company activity timeline
- `EmailThread`: Email conversation view

---

## 🔐 Authentication & Authorization

- **Google OAuth**: Sign in with Google
- **Supabase Auth**: User session management
- **OAuth Scopes**: Gmail send, Calendar events
- **Token Storage**: Google tokens stored in `user_sessions` table

---

## 📝 Next Steps for Cadences

### Potential Enhancements
1. **A/B Testing**: Test different cadence variations
2. **Analytics**: Track open rates, reply rates, conversion rates
3. **Templates**: Pre-built cadence templates
4. **Variables**: Dynamic content in emails (company name, industry, etc.)
5. **Multi-channel**: SMS, LinkedIn messages
6. **Personalization**: AI-generated personalized content
7. **Scheduling Rules**: Time-based execution (only on weekdays, specific hours)
8. **Error Handling**: Retry logic for failed actions
9. **Pause/Resume**: Manual pause and resume of executions
10. **Bulk Execution**: Run cadence for multiple companies at once

---

## 📚 Related Documentation

- `DIRECT_GOOGLE_OAUTH_SETUP.md`: OAuth setup guide
- `VAPI_VOICEMAIL_SETUP.md`: Voice call setup
- `API_CONFIGURATION_STATUS.md`: API configuration status
- `GOOGLE_OAUTH_SECURITY_ERROR_FIX.md`: OAuth troubleshooting

