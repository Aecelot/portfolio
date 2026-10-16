# Pipeline-CRM Requirements

## Overview

Pipeline-CRM is a specialized CRM application designed for managing relationships with game studios and investors in the gaming industry. The application enables users to track leads through customizable pipelines, manage notes, and import/export data.

## Functional Requirements

### FR-1: Authentication

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.1 | Users can sign in with Google OAuth | High | Complete |
| FR-1.2 | Users can sign out | High | Complete |
| FR-1.3 | Unauthenticated users are redirected to login | High | Complete |
| FR-1.4 | User session persists across browser refreshes | High | Complete |

### FR-2: Lead Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2.1 | Users can create new leads | High | Complete |
| FR-2.2 | Users can edit existing leads | High | Complete |
| FR-2.3 | Users can delete leads | High | Complete |
| FR-2.4 | Leads support two types: studio and investor | High | Complete |
| FR-2.5 | Leads have type-specific fields (studio: size, focus, games; investor: type, regions, focus) | High | Complete |
| FR-2.6 | Leads have common fields: name, contact, website, location, status, priority, tags | High | Complete |
| FR-2.7 | Users can view a list of all leads | High | Complete |
| FR-2.8 | Users can filter leads by type, status, priority | Medium | Complete |
| FR-2.9 | Users can search leads by name or email | Medium | Complete |
| FR-2.10 | Users can view detailed information for a single lead | High | Complete |

### FR-3: Pipeline Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.1 | Leads are organized in a Kanban-style pipeline view | High | Complete |
| FR-3.2 | Users can drag and drop leads between pipeline stages | High | Complete |
| FR-3.3 | Separate pipelines exist for studios and investors | High | Complete |
| FR-3.4 | Pipeline changes are persisted immediately | High | Complete |
| FR-3.5 | Optimistic updates provide immediate visual feedback | Medium | Complete |

### FR-4: Notes System

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-4.1 | Users can add notes to leads | High | Complete |
| FR-4.2 | Users can edit existing notes | Medium | Complete |
| FR-4.3 | Users can delete notes | Medium | Complete |
| FR-4.4 | Notes have a status indicator (cold/warm/hot) | Medium | Complete |
| FR-4.5 | Notes are displayed in reverse chronological order | Low | Complete |

### FR-5: Dashboard

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-5.1 | Dashboard displays key metrics (total leads, by type, by priority) | High | Complete |
| FR-5.2 | Dashboard shows recent leads | Medium | Complete |
| FR-5.3 | Dashboard provides pipeline stage summary | Medium | Complete |
| FR-5.4 | Dashboard displays recent activity feed | Low | Complete |

### FR-6: Import/Export

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-6.1 | Users can export leads to Excel (.xlsx) | High | Complete |
| FR-6.2 | Users can filter exports by lead type | Medium | Complete |
| FR-6.3 | Users can optionally include notes in export | Low | Complete |
| FR-6.4 | Users can import leads from Excel/CSV files | High | Complete |
| FR-6.5 | Import shows preview before committing | Medium | Complete |
| FR-6.6 | Import validates required fields (name, email) | High | Complete |
| FR-6.7 | Import shows progress and error reporting | Medium | Complete |

### FR-7: Settings

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-7.1 | Users can view their profile information | Medium | Complete |
| FR-7.2 | Settings page provides access to import/export | Medium | Complete |

## Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1.1 | Initial page load time | < 3 seconds |
| NFR-1.2 | Pipeline drag-drop response | < 100ms visual feedback |
| NFR-1.3 | Data operations (CRUD) | < 500ms |

### NFR-2: Usability

| ID | Requirement |
|----|-------------|
| NFR-2.1 | Application supports dark mode |
| NFR-2.2 | UI is responsive on desktop and tablet |
| NFR-2.3 | Navigation is consistent across all pages |
| NFR-2.4 | Error messages are clear and actionable |

### NFR-3: Security

| ID | Requirement |
|----|-------------|
| NFR-3.1 | All data access requires authentication |
| NFR-3.2 | Users can only access their own data |
| NFR-3.3 | Firebase security rules enforce data access |

### NFR-4: Reliability

| ID | Requirement |
|----|-------------|
| NFR-4.1 | Real-time sync with Firestore |
| NFR-4.2 | Optimistic updates with rollback on failure |
| NFR-4.3 | Graceful error handling throughout |

## Data Requirements

### Lead Entity

```
Lead
├── id: string (auto-generated)
├── name: string (required)
├── type: 'studio' | 'investor' (required)
├── status: string
├── priority: 'high' | 'medium' | 'low' | 'none'
├── owner: string (user ID)
├── contact
│   ├── name: string
│   ├── email: string (required for import)
│   ├── role: string
│   ├── phone: string
│   └── linkedin: string
├── website: string
├── country: string
├── location: string
├── notes: string
├── tags: string[]
├── pipeline
│   ├── pipelineId: string
│   ├── stageId: string
│   └── enteredStageAt: timestamp
├── studio? (if type === 'studio')
│   ├── size: string
│   ├── type: string
│   ├── games: string[]
│   ├── focus: string
│   ├── fitScore: number
│   └── fitReason: string
├── investor? (if type === 'investor')
│   ├── type: string
│   ├── founded: string
│   ├── investmentFocus: string
│   ├── fundingPreferences: string
│   ├── geographicalRegions: string[]
│   └── hqRegion: string
├── createdAt: timestamp
├── updatedAt: timestamp
└── createdBy: string
```

### Note Entity

```
Note
├── id: string (auto-generated)
├── leadId: string (reference to Lead)
├── content: string
├── status: 'cold' | 'warm' | 'hot'
├── createdAt: timestamp
├── updatedAt: timestamp
└── createdBy: string
```

### Pipeline Entity

```
Pipeline
├── id: string
├── name: string
├── type: 'studio' | 'investor'
├── stages: PipelineStage[]
│   ├── id: string
│   ├── name: string
│   ├── color: string
│   └── order: number
├── createdAt: timestamp
└── updatedAt: timestamp
```

## Technical Constraints

1. **Framework**: React 19 with TypeScript
2. **Build Tool**: Vite 7
3. **Styling**: Tailwind CSS v4 with shadcn/ui components
4. **Database**: Firebase Firestore (NoSQL)
5. **Authentication**: Firebase Authentication (Google OAuth)
6. **Drag & Drop**: @dnd-kit library
7. **Excel I/O**: xlsx library
8. **Testing**: Vitest with React Testing Library

## Future Considerations

- [ ] Multi-user collaboration with role-based access
- [ ] Email integration for lead communication tracking
- [ ] Calendar integration for scheduling
- [ ] Analytics and reporting dashboard
- [ ] Mobile application
- [ ] Bulk actions on leads list
- [ ] Tags filtering and management
- [ ] Keyboard shortcuts for power users
