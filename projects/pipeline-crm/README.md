# Pipeline-CRM

> **Example project, early prototype.** This is a sanitized copy of an early prototype / MVP, published as a
> code sample. It is **not used in production**, holds **no real company or personal data**, and its
> names, contacts and sample leads are fictional. The original private repository is not part of this
> portfolio.

A CRM prototype for managing game studio and investor leads, built with React 19, TypeScript, Tailwind CSS, and Firebase.

## Example data

`examples/example-leads.csv` contains fictional leads (all `.example` addresses). In the running app,
use **Settings, Import** and choose that file to fill the pipeline with demo data.

## Features

### Core Functionality
- **Lead Management**: Create, edit, and delete leads with full CRUD operations
- **Three Lead Types**: Support for studio, publisher, and investor leads with type-specific fields
- **Pipeline Kanban**: Drag-and-drop Kanban board for visual pipeline management
- **Notes System**: Add, edit, and delete notes on leads with status indicators (cold/warm/hot)
- **Team Notes**: Per-owner notes allowing each team member to maintain their own notes on leads
- **Contact Book**: Standalone contact entities with many-to-many linking to leads
- **Activity Logging**: Manual activity tracking (calls, emails, meetings, demos, LinkedIn messages)
- **Dashboard**: Overview with stats, recent leads, charts, and activity feed

### Data Management
- **Import**: Import leads from Excel (.xlsx, .xls) or CSV files with preview and validation
- **Export**: Export leads to Excel with filtering options (by type, include/exclude notes)
- **Newsletters**: Create and send newsletters to contact lists with tracking

### Lead Qualification
- **Prospect/Lead Categories**: Distinguish unqualified prospects from qualified leads
- **Multi-Factor Priority**: Auto-calculated priority from Fit (40%), Intent (40%), and Recency (20%)
- **Fit Criteria Rubric**: Checkbox-based fit scoring for studios and investors
- **Fit Tags**: Predefined tags (Narrative Focus, Innovation, Prototyping, etc.)

### User Interface
- **Modern UI**: Built with shadcn/ui components and Tailwind CSS
- **Dark Mode**: Full dark theme support
- **Responsive**: Works on desktop and tablet devices
- **Real-time Updates**: Firestore real-time listeners for live data sync

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| UI Components | shadcn/ui |
| Routing | React Router 7 |
| State | Custom hooks with Firestore |
| Drag & Drop | @dnd-kit |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Excel I/O | xlsx |
| Testing | Vitest + Testing Library |

## Project Structure

```
src/
├── components/
│   ├── dashboard/      # Dashboard widgets (StatsCards, RecentLeads, etc.)
│   ├── forms/          # Lead form components
│   ├── layout/         # App layout (TopBar, Sidebar, etc.)
│   ├── leads/          # Lead-related components (table, detail, dialogs)
│   ├── notes/          # Notes system components
│   ├── pipeline/       # Kanban board components
│   ├── settings/       # Settings page components (Export/Import dialogs)
│   └── ui/             # shadcn/ui base components
├── contexts/           # React contexts (Auth, Config)
├── hooks/              # Custom hooks (useLeads, usePipeline, useNotes, etc.)
├── lib/                # Utilities (firebase, firestore, stages, validators)
├── pages/              # Page components
└── types/              # TypeScript type definitions
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Firebase project with Firestore and Authentication enabled

### Installation

1. Clone the repository:
```bash
git clone https://github.com/example-user/pipeline-crm.git
cd Pipeline-CRM
```

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Create a `.env` file with your Firebase config
   - Or update `src/lib/firebase.ts` with your project credentials

4. Start development server:
```bash
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |

## Implementation Status

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Foundation & Routing | Complete |
| 2 | Dashboard | Complete |
| 3 | Leads List | Complete |
| 4 | Lead CRUD & Forms | Complete |
| 5 | Pipeline Kanban | Complete |
| 6 | Notes System | Complete |
| 7 | Settings & Export | Complete |
| 8 | Import | Complete |
| 9 | UX Improvements & Tags | Complete |
| 10 | Performance & Production | Complete |
| 11 | Contact Book | Complete |
| 12 | Lead Qualification | Complete |
| 13 | Newsletter System | Complete |

## Data Model

### Lead
```typescript
interface Lead {
  id: string;
  name: string;
  type: 'studio' | 'publisher' | 'investor';
  status: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  category?: 'prospect' | 'lead';
  owner: string;
  contact: LeadContact;
  website: string;
  country: string;
  location: string;
  notes: string;
  ownerNotes?: OwnerNote[];  // Per-team-member notes
  tags: string[];
  pipeline: PipelineInfo;
  studio?: StudioInfo;     // For studio/publisher leads
  investor?: InvestorInfo; // For investor leads
  // Qualification fields
  leadSource?: string;
  hasRequestedPricing?: boolean;
  hasRequestedDemo?: boolean;
  isDecisionMaker?: boolean;
  lastContactedAt?: Date;
  // Computed scores
  intentScore?: number;
  recencyScore?: number;
  priorityScore?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}
```

### StudioInfo
```typescript
interface StudioInfo {
  size: 'micro' | 'indie' | 'a' | 'aa' | 'aaa';  // Gaming industry sizes
  type: string;
  games: string[];
  focus: string;
  fitScore: number;
  fitReason: string;
  fitCriteria?: StudioFitCriteria;
  fitTags?: FitTag[];  // Narrative Focus, Innovation, etc.
}
```

### Contact
```typescript
interface Contact {
  id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  linkedin?: string;
  company?: string;
  tags?: string[];
}
```

### Activity
```typescript
interface Activity {
  id: string;
  leadId: string;
  type: ActivityType;  // lead_created, call, email, meeting, demo, etc.
  description: string;
  userId: string;
  userEmail: string;
  createdAt: Timestamp;
}
```

## License

MIT
